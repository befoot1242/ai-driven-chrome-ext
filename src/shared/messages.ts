// @trace DD-communication-001

export type MessageKind =
  | "OPEN_REGISTRATION"
  | "TASK_QUERY"
  | "TASK_SAVE"
  | "TASK_DELETE"
  | "SUPPRESSION_UPDATE"
  | "CAPTURE_REQUEST"
  | "CAPTURE_RESULT"
  | "CAPTURE_SCROLL"
  | "NAVIGATION_CHANGED";

export interface MessageErrorResponse {
  requestId: string;
  ok: false;
  code: "INVALID_REQUEST" | "OPERATION_UNAVAILABLE";
}
