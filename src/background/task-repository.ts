// @trace DD-task-001
import { sameDomainKey, type DomainKey } from "../shared/domain-types";
import { getDomainKeyFromHostname, normalizeHostname } from "../shared/domain";
import { validateImageLimits } from "../shared/image-validation";
import type { DomainSuppressionRecord, ImageRecord, TaskRecord } from "../shared/task-types";
import { isUtcInstant } from "../shared/utc-instant";

type RepositoryErrorCode =
  | "INVALID_TASK"
  | "INVALID_IMAGES"
  | "IMAGE_COUNT_EXCEEDED"
  | "IMAGE_SIZE_EXCEEDED"
  | "CONFLICT"
  | "NOT_FOUND"
  | "CORRUPT_DATA"
  | "INVALID_DOMAIN"
  | "INVALID_SUPPRESSION"
  | "DATABASE_BLOCKED";

export class TaskRepositoryError extends Error {
  constructor(public readonly code: RepositoryErrorCode) {
    super(code);
    this.name = "TaskRepositoryError";
  }
}

const DATABASE_NAME = "task-management";
const DATABASE_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    let blocked = false;
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore("tasks", { keyPath: "id" });
      database.createObjectStore("images", { keyPath: "id" }).createIndex("taskId", "taskId");
      database.createObjectStore("domain_suppressions", { keyPath: "hostname" });
      database.createObjectStore("edit_drafts", { keyPath: "id" });
      database
        .createObjectStore("capture_temp", { keyPath: "requestId" })
        .createIndex("owner", ["owner.kind", "owner.id"]);
    };
    request.onblocked = () => {
      blocked = true;
      reject(new TaskRepositoryError("DATABASE_BLOCKED"));
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      if (blocked) {
        database.close();
        return;
      }
      database.onversionchange = () => database.close();
      resolve(database);
    };
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transactionResult<T>(
  stores: string[],
  mode: IDBTransactionMode,
  operation: (transaction: IDBTransaction) => Promise<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(stores, mode);
    const completed = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error("TRANSACTION_ABORTED"));
      transaction.onerror = () => reject(transaction.error ?? new Error("TRANSACTION_FAILED"));
    });
    try {
      const result = await operation(transaction);
      await completed;
      return result;
    } catch (error) {
      try {
        transaction.abort();
      } catch (abortError) {
        if (!(abortError instanceof DOMException && abortError.name === "InvalidStateError")) {
          throw abortError;
        }
      }
      await completed.then(
        () => undefined,
        () => undefined,
      );
      throw error;
    }
  } finally {
    database.close();
  }
}

function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validateTask(task: TaskRecord, images: readonly ImageRecord[]): string {
  let url: URL;
  try {
    url = new URL(task.url);
  } catch (error) {
    if (error instanceof TypeError) throw new TaskRepositoryError("INVALID_TASK");
    throw error;
  }
  if (
    !task.id ||
    !task.name.trim() ||
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    (task.dueDate !== null && !isValidDate(task.dueDate)) ||
    !isUtcInstant(task.createdAt) ||
    (task.reminderSuppressedUntil !== null && !isUtcInstant(task.reminderSuppressedUntil)) ||
    !Number.isInteger(task.revision) ||
    task.revision < 0
  ) {
    throw new TaskRepositoryError("INVALID_TASK");
  }
  if (images.some((image) => !(image.data instanceof Blob))) {
    throw new TaskRepositoryError("INVALID_IMAGES");
  }
  const imageError = validateImageLimits(images.map((image) => image.data));
  if (imageError) throw new TaskRepositoryError(imageError);
  const ids = new Set<string>();
  for (const [position, image] of images.entries()) {
    if (
      !image.id ||
      image.id === task.id ||
      ids.has(image.id) ||
      image.taskId !== task.id ||
      image.position !== position
    ) {
      throw new TaskRepositoryError("INVALID_IMAGES");
    }
    ids.add(image.id);
  }
  return url.hostname;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStoredTask(value: unknown): TaskRecord {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.url !== "string" ||
    typeof value.hostname !== "string" ||
    typeof value.name !== "string" ||
    (value.dueDate !== null && typeof value.dueDate !== "string") ||
    typeof value.detail !== "string" ||
    typeof value.completed !== "boolean" ||
    typeof value.createdAt !== "string" ||
    (value.reminderSuppressedUntil !== null && typeof value.reminderSuppressedUntil !== "string") ||
    typeof value.revision !== "number"
  ) {
    throw new TaskRepositoryError("CORRUPT_DATA");
  }
  const task: TaskRecord = {
    id: value.id,
    url: value.url,
    hostname: value.hostname,
    name: value.name,
    dueDate: value.dueDate,
    detail: value.detail,
    completed: value.completed,
    createdAt: value.createdAt,
    reminderSuppressedUntil: value.reminderSuppressedUntil,
    revision: value.revision,
  };
  try {
    if (validateTask(task, []) !== task.hostname || !Number.isSafeInteger(task.revision) || task.revision < 1) {
      throw new TaskRepositoryError("CORRUPT_DATA");
    }
  } catch (error) {
    if (error instanceof TaskRepositoryError) throw new TaskRepositoryError("CORRUPT_DATA");
    throw error;
  }
  return task;
}

function readStoredImages(values: unknown[], task: TaskRecord): ImageRecord[] {
  const images: ImageRecord[] = values.map((value) => {
    if (
      !isRecord(value) ||
      typeof value.id !== "string" ||
      typeof value.taskId !== "string" ||
      typeof value.position !== "number" ||
      !(value.data instanceof Blob)
    ) {
      throw new TaskRepositoryError("CORRUPT_DATA");
    }
    return { id: value.id, taskId: value.taskId, position: value.position, data: value.data };
  });
  images.sort((left, right) => left.position - right.position);
  try {
    validateTask(task, images);
  } catch (error) {
    if (error instanceof TaskRepositoryError) throw new TaskRepositoryError("CORRUPT_DATA");
    throw error;
  }
  return images;
}

export async function listTasks(): Promise<TaskRecord[]> {
  return transactionResult(["tasks"], "readonly", async (transaction) => {
    const records = await requestResult<unknown[]>(transaction.objectStore("tasks").getAll());
    return records.map(readStoredTask);
  });
}

export async function getTask(
  id: string,
): Promise<{ task: TaskRecord; images: ImageRecord[] } | null> {
  return transactionResult(["tasks", "images"], "readonly", async (transaction) => {
    const record = await requestResult<unknown>(transaction.objectStore("tasks").get(id));
    if (record === undefined) return null;
    const task = readStoredTask(record);
    const records = await requestResult<unknown[]>(
      transaction.objectStore("images").index("taskId").getAll(id),
    );
    return { task, images: readStoredImages(records, task) };
  });
}

export async function saveTask(
  task: TaskRecord,
  images: ImageRecord[],
  expectedRevision: number | null,
): Promise<TaskRecord> {
  const hostname = validateTask(task, images);
  return transactionResult(["tasks", "images", "edit_drafts", "capture_temp"], "readwrite", async (transaction) => {
    const tasks = transaction.objectStore("tasks");
    const imageStore = transaction.objectStore("images");
    const drafts = transaction.objectStore("edit_drafts");
    const captures = transaction.objectStore("capture_temp");
    const record = await requestResult<unknown>(tasks.get(task.id));
    const current = record === undefined ? undefined : readStoredTask(record);
    if (expectedRevision === null ? Boolean(current) : !current || current.revision !== expectedRevision) {
      throw new TaskRepositoryError(current ? "CONFLICT" : "NOT_FOUND");
    }
    if (
      (await requestResult<unknown>(imageStore.get(task.id))) !== undefined ||
      (await requestResult<unknown>(drafts.get(task.id))) !== undefined ||
      (await requestResult<unknown>(captures.get(task.id))) !== undefined
    ) {
      throw new TaskRepositoryError("INVALID_TASK");
    }
    const oldRecords = await requestResult<unknown[]>(imageStore.index("taskId").getAll(task.id));
    if (!current && oldRecords.length !== 0) throw new TaskRepositoryError("CORRUPT_DATA");
    const oldImages = current ? readStoredImages(oldRecords, current) : [];
    for (const image of images) {
      const existing = await requestResult<unknown>(imageStore.get(image.id));
      if (existing !== undefined && (!isRecord(existing) || typeof existing.taskId !== "string")) {
        throw new TaskRepositoryError("CORRUPT_DATA");
      }
      if (isRecord(existing) && existing.taskId !== task.id) {
        throw new TaskRepositoryError("INVALID_IMAGES");
      }
      if (
        (await requestResult<unknown>(tasks.get(image.id))) !== undefined ||
        (await requestResult<unknown>(drafts.get(image.id))) !== undefined ||
        (await requestResult<unknown>(captures.get(image.id))) !== undefined
      ) {
        throw new TaskRepositoryError("INVALID_IMAGES");
      }
    }
    if (
      task.reminderSuppressedUntil !== null &&
      task.reminderSuppressedUntil !== current?.reminderSuppressedUntil &&
      Date.parse(task.reminderSuppressedUntil) <= Date.now()
    ) {
      throw new TaskRepositoryError("INVALID_SUPPRESSION");
    }
    const saved: TaskRecord = {
      ...task,
      hostname,
      createdAt: current?.createdAt ?? task.createdAt,
      revision: current ? current.revision + 1 : 1,
    };
    if (!Number.isSafeInteger(saved.revision)) throw new TaskRepositoryError("INVALID_TASK");
    for (const image of oldImages) imageStore.delete(image.id);
    for (const image of images) imageStore.put(image);
    tasks.put(saved);
    return saved;
  });
}

export async function deleteTask(id: string, expectedRevision: number): Promise<void> {
  await transactionResult(["tasks", "images"], "readwrite", async (transaction) => {
    const tasks = transaction.objectStore("tasks");
    const imageStore = transaction.objectStore("images");
    const record = await requestResult<unknown>(tasks.get(id));
    if (record === undefined) throw new TaskRepositoryError("NOT_FOUND");
    const current = readStoredTask(record);
    if (current.revision !== expectedRevision) throw new TaskRepositoryError("CONFLICT");
    const records = await requestResult<unknown[]>(imageStore.index("taskId").getAll(id));
    const images = readStoredImages(records, current);
    for (const image of images) imageStore.delete(image.id);
    tasks.delete(id);
  });
}

function isNormalizedHostname(hostname: string): boolean {
  try {
    return normalizeHostname(hostname) === hostname;
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}

function readDomainSuppression(value: unknown): DomainSuppressionRecord {
  if (
    !isRecord(value) ||
    typeof value.hostname !== "string" ||
    !isNormalizedHostname(value.hostname) ||
    typeof value.suppressedUntil !== "string" ||
    !isUtcInstant(value.suppressedUntil)
  ) {
    throw new TaskRepositoryError("CORRUPT_DATA");
  }
  return { hostname: value.hostname, suppressedUntil: value.suppressedUntil };
}

export function createDomainSuppressionRepository(
  getDomainKeyFromHostname: (hostname: string) => DomainKey,
): {
  listDomainSuppressions(): Promise<DomainSuppressionRecord[]>;
  updateDomainSuppression(hostname: string, suppressedUntil: string | null): Promise<void>;
} {
  return {
    async listDomainSuppressions() {
      return transactionResult(["domain_suppressions"], "readonly", async (transaction) => {
        const values = await requestResult<unknown[]>(transaction.objectStore("domain_suppressions").getAll());
        return values.map(readDomainSuppression);
      });
    },
    async updateDomainSuppression(hostname, suppressedUntil) {
      if (!isNormalizedHostname(hostname)) throw new TaskRepositoryError("INVALID_DOMAIN");
      if (suppressedUntil !== null && !isUtcInstant(suppressedUntil)) {
        throw new TaskRepositoryError("INVALID_SUPPRESSION");
      }
      const domain = getDomainKeyFromHostname(hostname);
      await transactionResult(["domain_suppressions"], "readwrite", async (transaction) => {
        if (suppressedUntil !== null && Date.parse(suppressedUntil) <= Date.now()) {
          throw new TaskRepositoryError("INVALID_SUPPRESSION");
        }
        const store = transaction.objectStore("domain_suppressions");
        const values = await requestResult<unknown[]>(store.getAll());
        const matching = values.map(readDomainSuppression).filter((entry) =>
          sameDomainKey(domain, getDomainKeyFromHostname(entry.hostname)),
        );
        if (suppressedUntil === null) {
          for (const entry of matching) store.delete(entry.hostname);
        } else if (matching.length === 0) {
          store.put({ hostname, suppressedUntil });
        } else {
          for (const entry of matching) store.put({ ...entry, suppressedUntil });
        }
      });
    },
  };
}

export const domainSuppressionRepository =
  createDomainSuppressionRepository(getDomainKeyFromHostname);
