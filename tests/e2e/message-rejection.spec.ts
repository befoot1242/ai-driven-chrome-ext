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

  test("一覧の権限がない画面からの一覧要求を拒否する", async ({ extensionContext, extensionId }) => {
    const page = await extensionContext.newPage();
    await page.goto(`chrome-extension://${extensionId}/options/index.html`);
    const response: unknown = await page.evaluate(() =>
      chrome.runtime.sendMessage({
        version: 1,
        requestId: "test",
        kind: "TASK_QUERY",
        payload: null,
      }),
    );
    expect(response).toEqual({ requestId: "test", ok: false, code: "UNAUTHORIZED" });
  });

  test("登録画面から一覧・削除・停止設定の要求を受け付けない", async ({ extensionContext, extensionId }) => {
    const page = await extensionContext.newPage();
    await page.goto(`chrome-extension://${extensionId}/registration/index.html`);
    for (const kind of ["TASK_QUERY", "TASK_DELETE", "SUPPRESSION_UPDATE"]) {
      const response: unknown = await page.evaluate((requestKind) =>
        chrome.runtime.sendMessage({
          version: 1,
          requestId: "test",
          kind: requestKind,
          payload: null,
        }), kind,
      );
      expect(response).toEqual({ requestId: "test", ok: false, code: "UNAUTHORIZED" });
    }
  });
});
