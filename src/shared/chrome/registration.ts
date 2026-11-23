// @trace DD-task-002 DD-communication-001
export function registerCommandListener(
  listener: Parameters<typeof chrome.commands.onCommand.addListener>[0],
): void {
  chrome.commands.onCommand.addListener(listener);
}

export async function openRegistrationWindow(query: string): Promise<void> {
  await chrome.windows.create({
    url: `registration/index.html?${query}`,
    type: "popup",
    width: 680,
    height: 720,
  });
}

export async function indicateRegistrationFailure(): Promise<void> {
  await chrome.action.setBadgeText({ text: "!" });
  await chrome.action.setTitle({ title: "タスク登録画面を開けませんでした。一覧で途中入力を確認してください。" });
}
