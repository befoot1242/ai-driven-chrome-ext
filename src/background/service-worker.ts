// @trace DD-communication-001
import { registerMessageListener } from "../shared/chrome/runtime-listener";
import { rejectUnavailableRequest } from "./message-router";

registerMessageListener((request: unknown, _sender, sendResponse) => {
  sendResponse(rejectUnavailableRequest(request));
});
