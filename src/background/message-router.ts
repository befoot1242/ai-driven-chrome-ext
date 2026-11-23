// @trace DD-communication-001
import type { MessageErrorResponse, MessageKind } from "../shared/messages";

const MESSAGE_KINDS: ReadonlySet<string> = new Set<MessageKind>([
  "OPEN_REGISTRATION",
  "TASK_QUERY",
  "TASK_SAVE",
  "TASK_DELETE",
  "SUPPRESSION_UPDATE",
  "START_DRAFT",
  "GET_ACTIVE_DRAFT",
  "SAVE_DRAFT",
  "RESUME_DRAFT",
  "DISCARD_DRAFT",
  "COMMIT_DRAFT",
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

export function isExtensionPageSender(
  sender: chrome.runtime.MessageSender,
  extensionId: string,
  extensionOrigin: string,
  path: string,
): boolean {
  if (sender.id !== extensionId || sender.origin !== extensionOrigin || !sender.url) return false;
  try {
    const url = new URL(sender.url);
    return url.protocol === "chrome-extension:" &&
      url.host === extensionId &&
      url.pathname === path;
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }
}

export function isPopupSender(
  sender: chrome.runtime.MessageSender,
  extensionId: string,
  extensionOrigin: string,
): boolean {
  return isExtensionPageSender(sender, extensionId, extensionOrigin, "/popup/index.html");
}
