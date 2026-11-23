// @trace TS-004
import { attachPopupTarget, expect, test } from "./extension-fixture";

test.describe("TS-004 popupのフレーム制限", () => {
  test("同じURLを子フレームに読み込む試みをCSPで拒否する", async ({
    extensionContext,
    extensionId,
  }) => {
    const worker = extensionContext.serviceWorkers()[0];
    if (!worker) throw new Error("拡張機能の Service Worker が見つかりません。");
    await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;
      if (tabId === undefined) throw new Error("対象タブが見つかりません。");
      await chrome.action.setPopup({ tabId, popup: "popup/index.html?probe=owner" });
      await chrome.action.openPopup();
    });
    const url = `chrome-extension://${extensionId}/popup/index.html?probe=owner`;
    const popup = await attachPopupTarget(extensionContext, url);
    try {
      const result = await popup.evaluate(`
        new Promise((resolve) => {
          const frame = document.createElement("iframe");
          frame.onload = () => resolve(frame.contentDocument === null ? "blocked" : "loaded");
          frame.src = location.href;
          document.body.appendChild(frame);
        });
      `);
      expect(result).toBe("blocked");
      const contexts = await worker.evaluate(async (documentUrl) => {
        const result = await chrome.runtime.getContexts({ documentUrls: [documentUrl] });
        return result.map((item) => ({ contextType: item.contextType, frameId: item.frameId }));
      }, url);
      expect(contexts).toEqual([{ contextType: "POPUP", frameId: 0 }]);
    } finally {
      await popup.close();
    }
  });
});
