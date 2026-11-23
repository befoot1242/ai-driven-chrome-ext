// @trace DD-communication-001

export function registerMessageListener(
  listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0],
): void {
  chrome.runtime.onMessage.addListener(listener);
}
