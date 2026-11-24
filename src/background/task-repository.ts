// @trace DD-task-001
import { sameDomainKey, type DomainKey } from "../shared/domain-types";
import { getDomainKeyFromHostname, normalizeHostname } from "../shared/domain";
import { validateImageLimits } from "../shared/image-validation";
import type { DomainSuppressionRecord, Draft, DraftFields, ImageRecord, OperationRef, TaskRecord } from "../shared/task-types";
import { validateTaskForm } from "../shared/task-validation";
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
  | "OPERATION_ACTIVE"
  | "STALE_OPERATION"
  | "INVALID_DRAFT"
  | "LEGACY_TEMP_DATA"
  | "DATABASE_BLOCKED";

export class TaskRepositoryError extends Error {
  constructor(public readonly code: RepositoryErrorCode) {
    super(code);
    this.name = "TaskRepositoryError";
  }
}

const DATABASE_NAME = "task-management";
const DATABASE_VERSION = 2;
const ACTIVE_OPERATION_KEY = "active";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    let blocked = false;
    let legacyTempData = false;
    request.onupgradeneeded = (event) => {
      const database = request.result;
      if (event.oldVersion === 0) {
        database.createObjectStore("tasks", { keyPath: "id" });
        database.createObjectStore("images", { keyPath: "id" }).createIndex("taskId", "taskId");
        database.createObjectStore("domain_suppressions", { keyPath: "hostname" });
        database.createObjectStore("edit_drafts", { keyPath: "id" });
        database
          .createObjectStore("capture_temp", { keyPath: "requestId" })
          .createIndex("owner", ["owner.kind", "owner.id"]);
      } else if (event.oldVersion === 1) {
        const transaction = request.transaction;
        if (!transaction) throw new Error("UPGRADE_TRANSACTION_MISSING");
        for (const name of ["edit_drafts", "capture_temp"]) {
          const count = transaction.objectStore(name).count();
          count.onsuccess = () => {
            if (count.result > 0) {
              legacyTempData = true;
              transaction.abort();
            }
          };
        }
      }
      database.createObjectStore("active_operation");
    };
    request.onblocked = () => {
      blocked = true;
      reject(new TaskRepositoryError("DATABASE_BLOCKED"));
    };
    request.onerror = () => reject(
      legacyTempData ? new TaskRepositoryError("LEGACY_TEMP_DATA") : request.error,
    );
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

function validateTask(task: TaskRecord, images: readonly ImageRecord[]): string {
  const { errors, hostname } = validateTaskForm(task);
  if (
    !task.id ||
    errors.name !== undefined ||
    errors.url !== undefined ||
    errors.dueDate !== undefined ||
    hostname === null ||
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
  return hostname;
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

interface ActiveOperation extends OperationRef {
  kind: Draft["kind"];
  draftId: string;
}

function readActiveOperation(value: unknown): ActiveOperation {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" || !value.id ||
    typeof value.generation !== "number" || !Number.isSafeInteger(value.generation) || value.generation < 1 ||
    (value.kind !== "registration" && value.kind !== "edit") ||
    typeof value.draftId !== "string" || !value.draftId
  ) {
    throw new TaskRepositoryError("CORRUPT_DATA");
  }
  return { id: value.id, generation: value.generation, kind: value.kind, draftId: value.draftId };
}

function validateDraft(draft: Draft): void {
  if (
    !draft || typeof draft.id !== "string" || !draft.id ||
    (draft.kind !== "registration" && draft.kind !== "edit") ||
    typeof draft.taskId !== "string" || !draft.taskId || draft.id === draft.taskId ||
    (draft.kind === "registration" ? draft.baseRevision !== null :
      !Number.isSafeInteger(draft.baseRevision) || (draft.baseRevision ?? 0) < 1) ||
    !draft.fields || typeof draft.fields.name !== "string" ||
    typeof draft.fields.url !== "string" || typeof draft.fields.dueDate !== "string" ||
    typeof draft.fields.detail !== "string" || !Array.isArray(draft.images)
  ) {
    throw new TaskRepositoryError("INVALID_DRAFT");
  }
  const ids = new Set<string>();
  for (const [position, image] of draft.images.entries()) {
    if (
      !image || typeof image.id !== "string" || !image.id ||
      image.id === draft.id || image.id === draft.taskId || ids.has(image.id) ||
      image.taskId !== draft.taskId || image.position !== position || !(image.data instanceof Blob)
    ) {
      throw new TaskRepositoryError("INVALID_IMAGES");
    }
    ids.add(image.id);
  }
  const imageError = validateImageLimits(draft.images.map((image) => image.data));
  if (imageError) throw new TaskRepositoryError(imageError);
}

function readStoredDraft(value: unknown): Draft {
  if (
    !isRecord(value) || typeof value.id !== "string" ||
    (value.kind !== "registration" && value.kind !== "edit") ||
    typeof value.taskId !== "string" ||
    (value.baseRevision !== null && typeof value.baseRevision !== "number") ||
    !isRecord(value.fields) || typeof value.fields.name !== "string" ||
    typeof value.fields.url !== "string" || typeof value.fields.dueDate !== "string" ||
    typeof value.fields.detail !== "string" || !Array.isArray(value.images)
  ) {
    throw new TaskRepositoryError("CORRUPT_DATA");
  }
  const images: ImageRecord[] = value.images.map((image: unknown) => {
    if (
      !isRecord(image) || typeof image.id !== "string" || typeof image.taskId !== "string" ||
      typeof image.position !== "number" || !(image.data instanceof Blob)
    ) {
      throw new TaskRepositoryError("CORRUPT_DATA");
    }
    return { id: image.id, taskId: image.taskId, position: image.position, data: image.data };
  });
  const draft: Draft = {
    id: value.id,
    kind: value.kind,
    taskId: value.taskId,
    baseRevision: value.baseRevision,
    fields: {
      name: value.fields.name,
      url: value.fields.url,
      dueDate: value.fields.dueDate,
      detail: value.fields.detail,
    },
    images,
  };
  try {
    validateDraft(draft);
  } catch (error) {
    if (error instanceof TaskRepositoryError) throw new TaskRepositoryError("CORRUPT_DATA");
    throw error;
  }
  return draft;
}

async function assertNoActiveOperation(transaction: IDBTransaction): Promise<void> {
  const value = await requestResult<unknown>(
    transaction.objectStore("active_operation").get(ACTIVE_OPERATION_KEY),
  );
  if (value !== undefined) {
    readActiveOperation(value);
    throw new TaskRepositoryError("OPERATION_ACTIVE");
  }
}

async function requireActiveOperation(
  transaction: IDBTransaction,
  ref: OperationRef,
): Promise<ActiveOperation> {
  const value = await requestResult<unknown>(
    transaction.objectStore("active_operation").get(ACTIVE_OPERATION_KEY),
  );
  if (value === undefined) throw new TaskRepositoryError("STALE_OPERATION");
  const active = readActiveOperation(value);
  if (active.id !== ref.id || active.generation !== ref.generation) {
    throw new TaskRepositoryError("STALE_OPERATION");
  }
  return active;
}

async function getOperationDraft(transaction: IDBTransaction, active: ActiveOperation): Promise<Draft> {
  const value = await requestResult<unknown>(transaction.objectStore("edit_drafts").get(active.draftId));
  const draft = readStoredDraft(value);
  if (draft.kind !== active.kind) throw new TaskRepositoryError("CORRUPT_DATA");
  return draft;
}

async function validateDraftIds(transaction: IDBTransaction, draft: Draft): Promise<void> {
  const tasks = transaction.objectStore("tasks");
  const images = transaction.objectStore("images");
  const drafts = transaction.objectStore("edit_drafts");
  const captures = transaction.objectStore("capture_temp");
  if (
    (await requestResult<unknown>(tasks.get(draft.id))) !== undefined ||
    (await requestResult<unknown>(images.get(draft.id))) !== undefined ||
    (await requestResult<unknown>(captures.get(draft.id))) !== undefined ||
    (await requestResult<unknown>(images.get(draft.taskId))) !== undefined ||
    (await requestResult<unknown>(drafts.get(draft.taskId))) !== undefined ||
    (await requestResult<unknown>(captures.get(draft.taskId))) !== undefined
  ) {
    throw new TaskRepositoryError("INVALID_DRAFT");
  }
  for (const image of draft.images) {
    const stored = await requestResult<unknown>(images.get(image.id));
    if (stored !== undefined && (!isRecord(stored) || typeof stored.taskId !== "string")) {
      throw new TaskRepositoryError("CORRUPT_DATA");
    }
    if (
      (isRecord(stored) && stored.taskId !== draft.taskId) ||
      (await requestResult<unknown>(tasks.get(image.id))) !== undefined ||
      (await requestResult<unknown>(drafts.get(image.id))) !== undefined ||
      (await requestResult<unknown>(captures.get(image.id))) !== undefined
    ) {
      throw new TaskRepositoryError("INVALID_IMAGES");
    }
  }
}

export async function startDraft(draft: Draft): Promise<OperationRef> {
  validateDraft(draft);
  return transactionResult(["active_operation", "edit_drafts", "tasks", "images", "capture_temp"], "readwrite", async (transaction) => {
    await assertNoActiveOperation(transaction);
    const draftStore = transaction.objectStore("edit_drafts");
    if ((await requestResult<unknown>(draftStore.get(draft.id))) !== undefined) {
      throw new TaskRepositoryError("CONFLICT");
    }
    const value = await requestResult<unknown>(transaction.objectStore("tasks").get(draft.taskId));
    const current = value === undefined ? undefined : readStoredTask(value);
    if (draft.kind === "registration" && current) throw new TaskRepositoryError("CONFLICT");
    if (draft.kind === "edit" && (!current || current.revision !== draft.baseRevision)) {
      throw new TaskRepositoryError(current ? "CONFLICT" : "NOT_FOUND");
    }
    await validateDraftIds(transaction, draft);
    const active: ActiveOperation = {
      id: crypto.randomUUID(),
      generation: 1,
      kind: draft.kind,
      draftId: draft.id,
    };
    draftStore.add(draft);
    transaction.objectStore("active_operation").add(active, ACTIVE_OPERATION_KEY);
    return { id: active.id, generation: active.generation };
  });
}

export async function getActiveDraft(): Promise<{ operation: OperationRef; draft: Draft } | null> {
  return transactionResult(["active_operation", "edit_drafts"], "readonly", async (transaction) => {
    const value = await requestResult<unknown>(
      transaction.objectStore("active_operation").get(ACTIVE_OPERATION_KEY),
    );
    if (value === undefined) return null;
    const active = readActiveOperation(value);
    return {
      operation: { id: active.id, generation: active.generation },
      draft: await getOperationDraft(transaction, active),
    };
  });
}

export async function saveDraft(ref: OperationRef, draft: Draft): Promise<void> {
  validateDraft(draft);
  await transactionResult(["active_operation", "edit_drafts", "tasks", "images", "capture_temp"], "readwrite", async (transaction) => {
    const active = await requireActiveOperation(transaction, ref);
    const current = await getOperationDraft(transaction, active);
    if (
      draft.id !== current.id || draft.kind !== current.kind ||
      draft.taskId !== current.taskId || draft.baseRevision !== current.baseRevision
    ) {
      throw new TaskRepositoryError("INVALID_DRAFT");
    }
    await validateDraftIds(transaction, draft);
    transaction.objectStore("edit_drafts").put(draft);
  });
}

export async function updateDraftFields(
  ref: OperationRef,
  fields: DraftFields,
  imageIds: string[],
): Promise<void> {
  await transactionResult(
    ["active_operation", "edit_drafts", "tasks", "images", "capture_temp"],
    "readwrite",
    async (transaction) => {
      const active = await requireActiveOperation(transaction, ref);
      const current = await getOperationDraft(transaction, active);
      const byId = new Map(current.images.map((image) => [image.id, image]));
      const images: ImageRecord[] = imageIds.map((id, position) => {
        const image = byId.get(id);
        if (!image) throw new TaskRepositoryError("INVALID_IMAGES");
        return { ...image, position };
      });
      const draft: Draft = { ...current, fields, images };
      validateDraft(draft);
      await validateDraftIds(transaction, draft);
      transaction.objectStore("edit_drafts").put(draft);
    },
  );
}

async function updateOperationCaptures(
  transaction: IDBTransaction,
  active: ActiveOperation,
  nextGeneration: number | null,
): Promise<void> {
  const captures = transaction.objectStore("capture_temp");
  const records = await requestResult<unknown[]>(
    captures.index("owner").getAll([active.kind, active.draftId]),
  );
  for (const record of records) {
    if (
      !isRecord(record) || typeof record.requestId !== "string" || !record.requestId ||
      !isRecord(record.operation) || record.operation.id !== active.id ||
      record.operation.generation !== active.generation ||
      (record.status !== "pending" && record.status !== "ready" && record.status !== "error")
    ) {
      throw new TaskRepositoryError("CORRUPT_DATA");
    }
    if (nextGeneration === null || record.status === "pending") {
      captures.delete(record.requestId);
    } else {
      captures.put({ ...record, operation: { id: active.id, generation: nextGeneration } });
    }
  }
}

export async function resumeDraft(ref: OperationRef): Promise<OperationRef> {
  return transactionResult(["active_operation", "edit_drafts", "capture_temp"], "readwrite", async (transaction) => {
    const active = await requireActiveOperation(transaction, ref);
    await getOperationDraft(transaction, active);
    const generation = active.generation + 1;
    if (!Number.isSafeInteger(generation)) throw new TaskRepositoryError("CORRUPT_DATA");
    await updateOperationCaptures(transaction, active, generation);
    transaction.objectStore("active_operation").put({ ...active, generation }, ACTIVE_OPERATION_KEY);
    return { id: active.id, generation };
  });
}

export async function discardDraft(ref: OperationRef): Promise<void> {
  await transactionResult(["active_operation", "edit_drafts", "capture_temp"], "readwrite", async (transaction) => {
    const active = await requireActiveOperation(transaction, ref);
    await getOperationDraft(transaction, active);
    await updateOperationCaptures(transaction, active, null);
    transaction.objectStore("edit_drafts").delete(active.draftId);
    transaction.objectStore("active_operation").delete(ACTIVE_OPERATION_KEY);
  });
}

export async function commitDraft(ref: OperationRef): Promise<TaskRecord> {
  return transactionResult(
    ["active_operation", "edit_drafts", "capture_temp", "tasks", "images"],
    "readwrite",
    async (transaction) => {
      const active = await requireActiveOperation(transaction, ref);
      const draft = await getOperationDraft(transaction, active);
      const value = await requestResult<unknown>(transaction.objectStore("tasks").get(draft.taskId));
      const current = value === undefined ? undefined : readStoredTask(value);
      const task: TaskRecord = {
        id: draft.taskId,
        url: draft.fields.url,
        hostname: current?.hostname ?? "",
        name: draft.fields.name,
        dueDate: draft.fields.dueDate === "" ? null : draft.fields.dueDate,
        detail: draft.fields.detail,
        completed: current?.completed ?? false,
        createdAt: current?.createdAt ?? new Date().toISOString(),
        reminderSuppressedUntil: current?.reminderSuppressedUntil ?? null,
        revision: current?.revision ?? 0,
      };
      const hostname = validateTask(task, draft.images);
      const result = await writeTask(transaction, task, draft.images, draft.baseRevision, hostname);
      await updateOperationCaptures(transaction, active, null);
      transaction.objectStore("edit_drafts").delete(active.draftId);
      transaction.objectStore("active_operation").delete(ACTIVE_OPERATION_KEY);
      return result;
    },
  );
}

export async function saveTask(
  task: TaskRecord,
  images: ImageRecord[],
  expectedRevision: number | null,
): Promise<TaskRecord> {
  const hostname = validateTask(task, images);
  return transactionResult(["tasks", "images", "edit_drafts", "capture_temp", "active_operation"], "readwrite", async (transaction) => {
    await assertNoActiveOperation(transaction);
    return writeTask(transaction, task, images, expectedRevision, hostname);
  });
}

export async function setTaskCompleted(
  id: string,
  expectedRevision: number,
  completed: boolean,
): Promise<TaskRecord> {
  return transactionResult(
    ["tasks", "images", "edit_drafts", "capture_temp", "active_operation"],
    "readwrite",
    async (transaction) => {
      await assertNoActiveOperation(transaction);
      const record = await requestResult<unknown>(transaction.objectStore("tasks").get(id));
      if (record === undefined) throw new TaskRepositoryError("NOT_FOUND");
      const task = readStoredTask(record);
      const values = await requestResult<unknown[]>(
        transaction.objectStore("images").index("taskId").getAll(id),
      );
      const images = readStoredImages(values, task);
      return writeTask(transaction, { ...task, completed }, images, expectedRevision, task.hostname);
    },
  );
}

export async function setTaskSuppression(
  id: string,
  expectedRevision: number,
  suppressedUntil: string | null,
): Promise<TaskRecord> {
  if (suppressedUntil !== null && !isUtcInstant(suppressedUntil)) {
    throw new TaskRepositoryError("INVALID_SUPPRESSION");
  }
  return transactionResult(
    ["tasks", "images", "edit_drafts", "capture_temp", "active_operation"],
    "readwrite",
    async (transaction) => {
      await assertNoActiveOperation(transaction);
      if (suppressedUntil !== null && Date.parse(suppressedUntil) <= Date.now()) {
        throw new TaskRepositoryError("INVALID_SUPPRESSION");
      }
      const record = await requestResult<unknown>(transaction.objectStore("tasks").get(id));
      if (record === undefined) throw new TaskRepositoryError("NOT_FOUND");
      const task = readStoredTask(record);
      const values = await requestResult<unknown[]>(
        transaction.objectStore("images").index("taskId").getAll(id),
      );
      const images = readStoredImages(values, task);
      return writeTask(
        transaction,
        { ...task, reminderSuppressedUntil: suppressedUntil },
        images,
        expectedRevision,
        task.hostname,
      );
    },
  );
}

async function writeTask(
  transaction: IDBTransaction,
  task: TaskRecord,
  images: ImageRecord[],
  expectedRevision: number | null,
  hostname: string,
): Promise<TaskRecord> {
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
}

export async function deleteTask(id: string, expectedRevision: number): Promise<void> {
  await transactionResult(["tasks", "images", "active_operation"], "readwrite", async (transaction) => {
    await assertNoActiveOperation(transaction);
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
      await transactionResult(["domain_suppressions", "active_operation"], "readwrite", async (transaction) => {
        await assertNoActiveOperation(transaction);
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
