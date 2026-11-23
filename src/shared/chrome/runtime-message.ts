// @trace DD-communication-001

export async function sendRuntimeMessage(message: unknown): Promise<unknown> {
  return chrome.runtime.sendMessage(message);
}
