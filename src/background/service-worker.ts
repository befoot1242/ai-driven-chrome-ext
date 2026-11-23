// @trace DD-communication-001 DD-task-001
import { getRuntimeIdentity, registerMessageListener } from "../shared/chrome/runtime-listener";
import {
  indicateRegistrationFailure,
  registerCommandListener,
} from "../shared/chrome/registration";
import type { DraftFields, OperationRef } from "../shared/task-types";
import { isExtensionPageSender, isPopupSender, rejectUnavailableRequest } from "./message-router";
import { beginRegistration } from "./registration-controller";
import {
  commitDraft,
  deleteTask,
  discardDraft,
  getActiveDraft,
  getTask,
  listTasks,
  resumeDraft,
  setTaskCompleted,
  startDraft,
  TaskRepositoryError,
  updateDraftFields,
} from "./task-repository";

class InvalidRequestError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOperation(value: unknown): OperationRef {
  if (
    !isRecord(value) || typeof value.id !== "string" || !value.id ||
    typeof value.generation !== "number" || !Number.isSafeInteger(value.generation) ||
    value.generation < 1
  ) throw new InvalidRequestError();
  return { id: value.id, generation: value.generation };
}

function readFields(value: unknown): DraftFields {
  if (
    !isRecord(value) || typeof value.name !== "string" || typeof value.url !== "string" ||
    typeof value.dueDate !== "string" || typeof value.detail !== "string"
  ) throw new InvalidRequestError();
  return { name: value.name, url: value.url, dueDate: value.dueDate, detail: value.detail };
}

function readTaskTarget(value: unknown): { id: string; expectedRevision: number } {
  if (
    !isRecord(value) || typeof value.id !== "string" || !value.id ||
    typeof value.expectedRevision !== "number" || !Number.isSafeInteger(value.expectedRevision) ||
    value.expectedRevision < 1
  ) throw new InvalidRequestError();
  return { id: value.id, expectedRevision: value.expectedRevision };
}

async function handlePopupRequest(kind: string, payload: unknown): Promise<unknown> {
  if (kind === "TASK_QUERY" && payload === null) return { tasks: await listTasks() };
  if (kind === "GET_ACTIVE_DRAFT" && payload === null) {
    const active = await getActiveDraft();
    return {
      active: active === null ? null : {
        operation: active.operation,
        draft: {
          id: active.draft.id,
          kind: active.draft.kind,
          taskId: active.draft.taskId,
          fields: active.draft.fields,
          imageIds: active.draft.images.map((image) => image.id),
        },
      },
    };
  }
  if (kind === "TASK_SAVE") {
    const target = readTaskTarget(payload);
    if (!isRecord(payload) || typeof payload.completed !== "boolean") throw new InvalidRequestError();
    await setTaskCompleted(target.id, target.expectedRevision, payload.completed);
    return null;
  }
  if (kind === "TASK_DELETE") {
    const target = readTaskTarget(payload);
    await deleteTask(target.id, target.expectedRevision);
    return null;
  }
  if (kind === "START_DRAFT") {
    if (!isRecord(payload) || typeof payload.id !== "string" || !payload.id) throw new InvalidRequestError();
    const result = await getTask(payload.id);
    if (!result) throw new TaskRepositoryError("NOT_FOUND");
    const operation = await startDraft({
      id: crypto.randomUUID(),
      kind: "edit",
      taskId: result.task.id,
      baseRevision: result.task.revision,
      fields: {
        name: result.task.name,
        url: result.task.url,
        dueDate: result.task.dueDate ?? "",
        detail: result.task.detail,
      },
      images: result.images,
    });
    return { operation };
  }
  if (kind === "SAVE_DRAFT") {
    if (!isRecord(payload) || !Array.isArray(payload.imageIds) || payload.imageIds.length > 10 ||
      !payload.imageIds.every((id: unknown) => typeof id === "string" && id.length > 0)) {
      throw new InvalidRequestError();
    }
    await updateDraftFields(readOperation(payload.operation), readFields(payload.fields), payload.imageIds);
    return null;
  }
  if (kind === "RESUME_DRAFT") return { operation: await resumeDraft(readOperation(payload)) };
  if (kind === "DISCARD_DRAFT") {
    await discardDraft(readOperation(payload));
    return null;
  }
  if (kind === "COMMIT_DRAFT") {
    await commitDraft(readOperation(payload));
    return null;
  }
  throw new InvalidRequestError();
}

const POPUP_OPERATIONS = new Set([
  "TASK_QUERY", "TASK_SAVE", "TASK_DELETE", "START_DRAFT", "GET_ACTIVE_DRAFT",
  "SAVE_DRAFT", "RESUME_DRAFT", "DISCARD_DRAFT", "COMMIT_DRAFT",
]);
const REGISTRATION_OPERATIONS = new Set([
  "GET_ACTIVE_DRAFT", "SAVE_DRAFT", "RESUME_DRAFT", "DISCARD_DRAFT", "COMMIT_DRAFT",
]);

registerMessageListener((request: unknown, sender, sendResponse) => {
  const validation = rejectUnavailableRequest(request);
  if (
    validation.code !== "OPERATION_UNAVAILABLE" ||
    !isRecord(request) || typeof request.kind !== "string" ||
    (!POPUP_OPERATIONS.has(request.kind) && !REGISTRATION_OPERATIONS.has(request.kind))
  ) {
    sendResponse(validation);
    return;
  }
  const identity = getRuntimeIdentity();
  const popupAllowed = POPUP_OPERATIONS.has(request.kind) &&
    isPopupSender(sender, identity.id, identity.origin);
  const registrationAllowed = REGISTRATION_OPERATIONS.has(request.kind) &&
    isExtensionPageSender(sender, identity.id, identity.origin, "/registration/index.html");
  if (!popupAllowed && !registrationAllowed) {
    sendResponse({ requestId: validation.requestId, ok: false, code: "UNAUTHORIZED" });
    return;
  }
  void handlePopupRequest(request.kind, request.payload).then(
    (payload) => sendResponse({ requestId: validation.requestId, ok: true, payload }),
    (error: unknown) => {
      const code = error instanceof TaskRepositoryError ? error.code
        : error instanceof InvalidRequestError ? "INVALID_REQUEST"
          : error instanceof DOMException && error.name === "QuotaExceededError" ? "STORAGE_FULL"
          : "OPERATION_FAILED";
      console.error(code);
      sendResponse({ requestId: validation.requestId, ok: false, code });
    },
  );
  return true;
});

registerCommandListener((command, tab) => {
  if (command !== "open-registration") return;
  void beginRegistration(tab).catch(async () => {
    console.error("REGISTRATION_WINDOW_FAILED");
    try {
      await indicateRegistrationFailure();
    } catch {
      console.error("REGISTRATION_BADGE_FAILED");
    }
  });
});
