// @trace DD-communication-001 DD-task-002
import { sendRuntimeMessage } from "../shared/chrome/runtime-message";
import type { DraftFields, OperationRef, TaskRecord } from "../shared/task-types";

export interface ActiveDraftView {
  operation: OperationRef;
  draft: {
    id: string;
    kind: "registration" | "edit";
    taskId: string;
    fields: DraftFields;
    imageIds: string[];
  };
}

export class PopupOperationError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function request(kind: string, payload: unknown): Promise<unknown> {
  const requestId = crypto.randomUUID();
  let response: unknown;
  try {
    response = await sendRuntimeMessage({ version: 1, requestId, kind, payload });
  } catch {
    throw new PopupOperationError("COMMUNICATION_FAILED");
  }
  if (!isRecord(response) || response.requestId !== requestId || typeof response.ok !== "boolean") {
    throw new PopupOperationError("COMMUNICATION_FAILED");
  }
  if (!response.ok) {
    if (typeof response.code !== "string") throw new PopupOperationError("COMMUNICATION_FAILED");
    throw new PopupOperationError(response.code);
  }
  if (!("payload" in response)) throw new PopupOperationError("COMMUNICATION_FAILED");
  return response.payload;
}

function isTaskRecord(value: unknown): value is TaskRecord {
  return isRecord(value) &&
    typeof value.id === "string" && typeof value.url === "string" &&
    typeof value.hostname === "string" && typeof value.name === "string" &&
    (typeof value.dueDate === "string" || value.dueDate === null) &&
    typeof value.detail === "string" && typeof value.completed === "boolean" &&
    typeof value.createdAt === "string" &&
    (typeof value.reminderSuppressedUntil === "string" || value.reminderSuppressedUntil === null) &&
    typeof value.revision === "number";
}

export async function queryTasks(): Promise<TaskRecord[]> {
  const payload = await request("TASK_QUERY", null);
  if (!isRecord(payload) || !Array.isArray(payload.tasks) || !payload.tasks.every(isTaskRecord)) {
    throw new PopupOperationError("COMMUNICATION_FAILED");
  }
  return payload.tasks;
}

export async function queryActiveDraft(): Promise<ActiveDraftView | null> {
  const payload = await request("GET_ACTIVE_DRAFT", null);
  if (!isRecord(payload) || !("active" in payload)) throw new PopupOperationError("COMMUNICATION_FAILED");
  if (payload.active === null) return null;
  const active = payload.active;
  if (
    !isRecord(active) || !isRecord(active.operation) ||
    typeof active.operation.id !== "string" || typeof active.operation.generation !== "number" ||
    !isRecord(active.draft) || typeof active.draft.id !== "string" ||
    (active.draft.kind !== "registration" && active.draft.kind !== "edit") ||
    typeof active.draft.taskId !== "string" || !isRecord(active.draft.fields) ||
    typeof active.draft.fields.name !== "string" || typeof active.draft.fields.url !== "string" ||
    typeof active.draft.fields.dueDate !== "string" || typeof active.draft.fields.detail !== "string" ||
    !Array.isArray(active.draft.imageIds) ||
    !active.draft.imageIds.every((id: unknown) => typeof id === "string")
  ) {
    throw new PopupOperationError("COMMUNICATION_FAILED");
  }
  return {
    operation: { id: active.operation.id, generation: active.operation.generation },
    draft: {
      id: active.draft.id,
      kind: active.draft.kind,
      taskId: active.draft.taskId,
      fields: {
        name: active.draft.fields.name,
        url: active.draft.fields.url,
        dueDate: active.draft.fields.dueDate,
        detail: active.draft.fields.detail,
      },
      imageIds: active.draft.imageIds,
    },
  };
}

export function readOperationResult(value: unknown): OperationRef {
  if (
    !isRecord(value) || !isRecord(value.operation) ||
    typeof value.operation.id !== "string" ||
    typeof value.operation.generation !== "number" ||
    !Number.isSafeInteger(value.operation.generation) || value.operation.generation < 1
  ) {
    throw new PopupOperationError("COMMUNICATION_FAILED");
  }
  return { id: value.operation.id, generation: value.operation.generation };
}

export function operationErrorMessage(error: unknown): string {
  if (!(error instanceof PopupOperationError)) return "操作に失敗しました。";
  switch (error.code) {
    case "OPERATION_ACTIVE":
      return "登録または編集が進行中です。完了するか破棄してください。";
    case "STALE_OPERATION":
      return "操作が別の画面で再開または終了されました。一覧を開き直してください。";
    case "CONFLICT":
      return "保存済みデータが変更されています。入力は保持されています。";
    case "NOT_FOUND":
      return "対象のタスクが見つかりません。入力は保持されています。";
    case "LEGACY_TEMP_DATA":
      return "以前の途中入力または撮影結果を移行できないため、タスクを読み込めません。データは削除されていません。";
    case "DATABASE_BLOCKED":
      return "保存データの更新を待っています。別の拡張機能画面を閉じて再試行してください。";
    case "STORAGE_FULL":
      return "保存領域の空き容量が不足しています。入力は保持されています。";
    case "COMMUNICATION_FAILED":
      return "結果を確認できませんでした。再読み込みして状態を確認してください。";
    default:
      return "操作に失敗しました。";
  }
}
