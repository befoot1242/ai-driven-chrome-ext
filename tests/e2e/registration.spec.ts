// @trace TS-001 TS-002
import { createServer } from "node:http";
import { resolve } from "node:path";
import { build } from "vite";
import { expect, test } from "./extension-fixture";

test.describe("TS-001 登録画面起動の補助確認", () => {
  test("対象ページの登録と、進行中の別登録の拒否を確認する", async ({ extensionContext, extensionId }) => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<!doctype html><title>登録試験</title><p>試験ページ</p>");
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("試験サーバーのポートを取得できません。");
      const origin = `http://127.0.0.1:${address.port}`;
      const page = await extensionContext.newPage();
      await page.goto(`${origin}/first?test=1`);
      await page.bringToFront();
      const worker = extensionContext.serviceWorkers()[0];
      if (!worker) throw new Error("Service Worker が見つかりません。");
      const commands = await worker.evaluate(() => chrome.commands.getAll());
      expect(commands).toContainEqual(expect.objectContaining({ name: "open-registration", shortcut: "Ctrl+Shift+Y" }));
      const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id);
      if (tabId === undefined) throw new Error("試験タブを取得できません。");
      const output = await build({
        configFile: false,
        logLevel: "silent",
        build: {
          write: false,
          rollupOptions: {
            input: resolve("src/background/registration-controller.ts"),
            preserveEntrySignatures: "strict",
            output: { format: "iife", name: "__testRegistrationController" },
          },
        },
      });
      if (Array.isArray(output) || !("output" in output)) throw new Error("試験用ビルドを取得できません。");
      const bundle = output.output.find((item) => item.type === "chunk");
      if (!bundle || bundle.type !== "chunk") throw new Error("試験用コードを取得できません。");
      const helper = await extensionContext.newPage();
      await helper.goto(`chrome-extension://${extensionId}/options/index.html`);
      const debuggerSession = await extensionContext.newCDPSession(helper);
      try {
        const result = await debuggerSession.send("Runtime.evaluate", {
          expression: bundle.code,
          allowUnsafeEvalBlockedByCSP: true,
        });
        if (result.exceptionDetails) throw new Error("試験用コードを実行できません。");
      } finally {
        await debuggerSession.detach();
      }
      const registrationPromise = extensionContext.waitForEvent("page");
      await helper.evaluate(async (tab) => {
        const controller = (
          globalThis as typeof globalThis & {
            __testRegistrationController: typeof import("../../src/background/registration-controller");
          }
        ).__testRegistrationController;
        await controller.beginRegistration(tab);
      }, { id: tabId, url: page.url() });
      const registration = await registrationPromise;
      await expect(registration).toHaveURL(/registration\/index\.html/);
      await expect(registration.getByTestId("edit-url")).toHaveValue(`${origin}/first?test=1`);
      await expect(registration.getByTestId("edit-url")).toBeDisabled();
      await registration.getByTestId("edit-name").fill("最初のページのタスク");
      await expect(registration.getByTestId("draft-status")).toHaveText("保存済み");
      const duplicate = await extensionContext.newPage();
      await duplicate.goto(registration.url());
      await expect(duplicate.getByTestId("registration-error")).toContainText("別の画面");
      await expect(duplicate.getByTestId("edit-name")).toHaveCount(0);
      await duplicate.close();

      const other = await extensionContext.newPage();
      await other.goto(`${origin}/second`);
      await other.bringToFront();
      const otherTabId = await worker.evaluate(async () =>
        (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id,
      );
      if (otherTabId === undefined) throw new Error("別の試験タブを取得できません。");
      const blockedPromise = extensionContext.waitForEvent("page");
      await helper.evaluate(async (tab) => {
        const controller = (
          globalThis as typeof globalThis & {
            __testRegistrationController: typeof import("../../src/background/registration-controller");
          }
        ).__testRegistrationController;
        await controller.beginRegistration(tab);
      }, { id: otherTabId, url: other.url() });
      const blocked = await blockedPromise;
      await expect(blocked.getByTestId("registration-error")).toContainText("進行中");
      await expect(registration.getByTestId("edit-name")).toHaveValue("最初のページのタスク");
      await blocked.close();

      await registration.getByTestId("edit-save").click();
      await expect.poll(() => registration.isClosed()).toBe(true);
      const popup = await extensionContext.newPage();
      await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
      await expect(popup.getByTestId("task-item")).toContainText("最初のページのタスク");
      await popup.getByTestId("task-edit").click();
      await expect(popup.getByTestId("edit-url")).toHaveValue(`${origin}/first?test=1`);
      await popup.getByTestId("edit-cancel").click();
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
