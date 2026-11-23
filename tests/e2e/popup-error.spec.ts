// @trace TS-002 TS-004
import { attachPopupTarget, expect, test } from "./extension-fixture";

test.describe("TS-002 一覧取得エラーの補助確認", () => {
  test("未対応の一覧要求を空一覧とせず通知し、再試行できる", async ({
    extensionContext,
    extensionId,
  }) => {
    const page = await extensionContext.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup/index.html`);
    const error = page.getByTestId("task-error");
    await expect(error).toHaveText("タスク一覧は現在利用できません。");
    await expect(error).toBeFocused();
    await expect(page.getByTestId("task-loading")).toHaveCount(0);
    await page.getByTestId("task-retry").click();
    await expect(error).toHaveText("タスク一覧は現在利用できません。");
    await expect(error).toBeFocused();
  });

  test("拡張機能アイコンのポップアップから一覧取得エラーを表示する", async ({
    extensionContext,
    extensionId,
  }) => {
    const worker = extensionContext.serviceWorkers()[0];
    if (!worker) throw new Error("拡張機能の Service Worker が見つかりません。");
    await worker.evaluate(() => chrome.action.openPopup());
    const popup = await attachPopupTarget(extensionContext, `chrome-extension://${extensionId}/popup/index.html`);
    try {
      await expect.poll(() =>
        popup.evaluate("document.querySelector('[data-testid=\"task-error\"]')?.textContent"),
      ).toBe("タスク一覧は現在利用できません。");
    } finally {
      await popup.close();
    }
  });
});
