// @trace DD-communication-001
import type { MessageErrorResponse, MessageKind } from "../shared/messages";

const MESSAGE_KINDS: ReadonlySet<string> = new Set<MessageKind>([
  "OPEN_REGISTRATION",
  "TASK_QUERY",
  "TASK_SAVE",
  "TASK_DELETE",
  "SUPPRESSION_UPDATE",
  "CAPTURE_REQUEST",
  "CAPTURE_RESULT",
  "CAPTURE_SCROLL",
  "NAVIGATION_CHANGED",
]);

export function rejectUnavailableRequest(request: unknown): MessageErrorResponse {
  if (typeof request !== "object" || request === null || Array.isArray(request)) {
    return { requestId: "", ok: false, code: "INVALID_REQUEST" };
  }
  if (!("requestId" in request) || typeof request.requestId !== "string" || !request.requestId) {
    return { requestId: "", ok: false, code: "INVALID_REQUEST" };
  }
  const requestId = request.requestId;
  if (
    !("version" in request) ||
    request.version !== 1 ||
    !("kind" in request) ||
    typeof request.kind !== "string" ||
    !MESSAGE_KINDS.has(request.kind) ||
    !("payload" in request)
  ) {
    return { requestId, ok: false, code: "INVALID_REQUEST" };
  }
  return { requestId, ok: false, code: "OPERATION_UNAVAILABLE" };
}
