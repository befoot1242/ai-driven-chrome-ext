// @trace TS-004
import { expect, test } from "./extension-fixture";

test.describe("TS-004 通信要求の補助確認", () => {
  test("未対応の版を拡張機能が拒否する", async ({ extensionContext, extensionId }) => {
    const page = await extensionContext.newPage();
    await page.goto(`chrome-extension://${extensionId}/options/index.html`);
    const response: unknown = await page.evaluate(() =>
      chrome.runtime.sendMessage({
        version: 2,
        requestId: "test",
        kind: "TASK_QUERY",
        payload: null,
      }),
    );
    expect(response).toEqual({ requestId: "test", ok: false, code: "INVALID_REQUEST" });
  });
});
