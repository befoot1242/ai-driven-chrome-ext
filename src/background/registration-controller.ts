// @trace DD-task-002 DD-communication-001 DD-task-001
import { openRegistrationWindow } from "../shared/chrome/registration";
import type { OperationRef } from "../shared/task-types";
import { startDraft, TaskRepositoryError } from "./task-repository";

class InvalidTargetError extends Error {}

export async function beginRegistration(tab: Pick<chrome.tabs.Tab, "id" | "url"> | undefined): Promise<void> {
  let url: URL;
  try {
    if (!tab || typeof tab.id !== "number" || typeof tab.url !== "string") {
      throw new InvalidTargetError();
    }
    url = new URL(tab.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new InvalidTargetError();
  } catch (error) {
    if (!(error instanceof InvalidTargetError || error instanceof TypeError)) throw error;
    await openRegistrationWindow(new URLSearchParams({ error: "INVALID_TARGET" }).toString());
    return;
  }

  let operation: OperationRef;
  try {
    operation = await startDraft({
      id: crypto.randomUUID(),
      kind: "registration",
      taskId: crypto.randomUUID(),
      baseRevision: null,
      fields: { name: "", url: url.href, dueDate: "", detail: "" },
      images: [],
    });
  } catch (error) {
    const code = error instanceof TaskRepositoryError ? error.code : "OPERATION_FAILED";
    console.error(code);
    await openRegistrationWindow(new URLSearchParams({ error: code }).toString());
    return;
  }
  await openRegistrationWindow(new URLSearchParams({
    operation: operation.id,
    generation: String(operation.generation),
  }).toString());
}
