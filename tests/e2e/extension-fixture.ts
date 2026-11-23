// @trace TS-001 TS-002 TS-003 TS-004
import { chromium, expect, test as base, type BrowserContext } from "@playwright/test";
import { resolve } from "node:path";

type ExtensionFixtures = {
  extensionContext: BrowserContext;
  extensionId: string;
};

export const test = base.extend<ExtensionFixtures>({
  extensionContext: async ({}, use) => {
    const extensionPath = resolve("dist");
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    try {
      await use(context);
    } finally {
      await context.close();
    }
  },

  extensionId: async ({ extensionContext }, use) => {
    const worker =
      extensionContext.serviceWorkers()[0] ??
      (await extensionContext.waitForEvent("serviceworker"));
    await use(new URL(worker.url()).host);
  },
});

export async function attachPopupTarget(
  context: BrowserContext,
  url: string,
): Promise<{ evaluate(expression: string): Promise<unknown>; close(): Promise<void> }> {
  const browser = context.browser();
  if (!browser) throw new Error("テスト用ブラウザーが見つかりません。");
  const debuggerSession = await browser.newBrowserCDPSession();
  try {
    let targetId: string | undefined;
    await expect.poll(async () => {
      const targets = await debuggerSession.send("Target.getTargets");
      targetId = targets.targetInfos.find((target) => target.url === url)?.targetId;
      return Boolean(targetId);
    }).toBe(true);
    if (!targetId) throw new Error("ポップアップのターゲットが見つかりません。");
    const { sessionId } = await debuggerSession.send("Target.attachToTarget", { targetId, flatten: false });
    let messageId = 0;
    return {
      async evaluate(expression) {
        const id = ++messageId;
        const received = new Promise<unknown>((resolve, reject) => {
          function onMessage(event: { sessionId: string; message: string }): void {
            if (event.sessionId !== sessionId) return;
            const response = JSON.parse(event.message) as {
              id?: number;
              result?: { result?: { value?: unknown }; exceptionDetails?: { text?: string } };
              error?: { message: string };
            };
            if (response.id !== id) return;
            debuggerSession.off("Target.receivedMessageFromTarget", onMessage);
            if (response.error) reject(new Error(response.error.message));
            else if (response.result?.exceptionDetails) {
              reject(new Error(response.result.exceptionDetails.text ?? "ポップアップでの評価に失敗しました。"));
            } else resolve(response.result?.result?.value);
          }
          debuggerSession.on("Target.receivedMessageFromTarget", onMessage);
        });
        await debuggerSession.send("Target.sendMessageToTarget", {
          sessionId,
          message: JSON.stringify({
            id,
            method: "Runtime.evaluate",
            params: { expression, returnByValue: true, awaitPromise: true },
          }),
        });
        return received;
      },
      async close() {
        await debuggerSession.detach();
      },
    };
  } catch (error) {
    await debuggerSession.detach();
    throw error;
  }
}

export { expect };
