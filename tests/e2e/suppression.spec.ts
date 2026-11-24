// @trace TS-003 TS-004
import type { Page } from "@playwright/test";
import { expect, test } from "./extension-fixture";

async function seed(page: Page, extensionId: string): Promise<void> {
  await page.goto(`chrome-extension://${extensionId}/options/index.html`);
  await page.evaluate(async () => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("task-management", 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      const tasks = database.createObjectStore("tasks", { keyPath: "id" });
      const images = database.createObjectStore("images", { keyPath: "id" });
      images.createIndex("taskId", "taskId");
      const suppressions = database.createObjectStore("domain_suppressions", { keyPath: "hostname" });
      database.createObjectStore("edit_drafts", { keyPath: "id" });
      database.createObjectStore("capture_temp", { keyPath: "requestId" })
        .createIndex("owner", ["owner.kind", "owner.id"]);
      database.createObjectStore("active_operation");
      tasks.put({
        id: "task-1", url: "https://a.example.com/", hostname: "a.example.com",
        name: "停止対象", dueDate: null, detail: "", completed: false,
        createdAt: "2026-01-01T00:00:00.000Z", reminderSuppressedUntil: null, revision: 1,
      });
      images.put({ id: "image-1", taskId: "task-1", position: 0, data: new Blob(["画像の内容"]) });
      suppressions.put({ hostname: "a.example.com", suppressedUntil: "2098-01-01T00:00:00.000Z" });
      suppressions.put({ hostname: "b.example.com", suppressedUntil: "2098-02-01T00:00:00.000Z" });
      suppressions.put({ hostname: "other.test", suppressedUntil: "2098-01-01T00:00:00.000Z" });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
  }));
}

async function readStored(page: Page): Promise<{ task: unknown; images: unknown[]; domains: unknown[] }> {
  return page.evaluate(async () => new Promise((resolve, reject) => {
    const request = indexedDB.open("task-management");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(["tasks", "images", "domain_suppressions"], "readonly");
      const task = transaction.objectStore("tasks").get("task-1");
      const images = transaction.objectStore("images").getAll();
      const domains = transaction.objectStore("domain_suppressions").getAll();
      transaction.oncomplete = () => {
        database.close();
        resolve({ task: task.result, images: images.result, domains: domains.result });
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error);
      };
    };
  }));
}

test.describe("TS-003 一覧のリマインド停止設定", () => {
  test("タスクと同一対象のドメイン設定を変更・解除し、他のデータを保持する", async ({
    extensionContext, extensionId,
  }) => {
    const page = await extensionContext.newPage();
    await seed(page, extensionId);
    const cdp = await extensionContext.newCDPSession(page);
    await cdp.send("Emulation.setTimezoneOverride", { timezoneId: "America/New_York" });
    await page.goto(`chrome-extension://${extensionId}/popup/index.html`);
    await page.getByTestId("task-suppression").click();
    await expect(page.getByTestId("suppression-zone")).toContainText("America/New_York");
    await page.getByTestId("suppression-date").fill("2099-12-01");
    await page.getByTestId("suppression-time").fill("10:30");
    await page.getByTestId("suppression-save").click();
    await expect(page.getByTestId("task-item")).toHaveCount(1);
    expect(await readStored(page)).toMatchObject({
      task: { reminderSuppressedUntil: "2099-12-01T15:30:00.000Z", revision: 2 },
      images: [{ id: "image-1", taskId: "task-1" }],
    });
    await page.getByTestId("task-suppression").click();
    await expect(page.getByTestId("suppression-current")).toContainText("10:30:00.000");
    await cdp.send("Emulation.setTimezoneOverride", { timezoneId: "Etc/UTC" });
    await page.getByTestId("suppression-cancel").click();
    await page.getByTestId("task-suppression").click();
    await expect(page.getByTestId("suppression-current")).toContainText("15:30:00.000");
    expect((await readStored(page)).task).toMatchObject({
      reminderSuppressedUntil: "2099-12-01T15:30:00.000Z",
    });
    await page.getByTestId("suppression-clear").click();
    await expect(page.getByTestId("task-item")).toHaveCount(1);
    expect(await readStored(page)).toMatchObject({
      task: { reminderSuppressedUntil: null, revision: 3 },
      images: [{ id: "image-1" }],
    });

    await cdp.send("Emulation.setTimezoneOverride", { timezoneId: "America/New_York" });
    await page.getByTestId("domain-filter").selectOption({ label: "example.com" });
    await page.getByTestId("domain-suppression").click();
    await expect(page.getByTestId("suppression-current")).not.toHaveText("現在の設定: なし");
    await page.getByTestId("suppression-date").fill("2099-12-01");
    await page.getByTestId("suppression-time").fill("10:30");
    await page.getByTestId("suppression-save").click();
    await expect(page.getByTestId("domain-suppression")).toBeVisible();
    expect((await readStored(page)).domains).toEqual([
      { hostname: "a.example.com", suppressedUntil: "2099-12-01T15:30:00.000Z" },
      { hostname: "b.example.com", suppressedUntil: "2099-12-01T15:30:00.000Z" },
      { hostname: "other.test", suppressedUntil: "2098-01-01T00:00:00.000Z" },
    ]);
    await page.getByTestId("domain-suppression").click();
    await page.getByTestId("suppression-clear").click();
    await expect(page.getByTestId("domain-suppression")).toBeVisible();
    expect((await readStored(page)).domains).toEqual([
      { hostname: "other.test", suppressedUntil: "2098-01-01T00:00:00.000Z" },
    ]);
    await page.getByTestId("domain-suppression").click();
    await page.getByTestId("suppression-date").fill("2099-12-01");
    await page.getByTestId("suppression-time").fill("10:30");
    await page.getByTestId("suppression-save").click();
    await expect(page.getByTestId("domain-suppression")).toBeVisible();
    expect((await readStored(page)).domains).toEqual([
      { hostname: "example.com", suppressedUntil: "2099-12-01T15:30:00.000Z" },
      { hostname: "other.test", suppressedUntil: "2098-01-01T00:00:00.000Z" },
    ]);
  });

  test("重複日時で選んだオフセットの瞬間を保存する", async ({ extensionContext, extensionId }) => {
    const page = await extensionContext.newPage();
    await seed(page, extensionId);
    const cdp = await extensionContext.newCDPSession(page);
    await cdp.send("Emulation.setTimezoneOverride", { timezoneId: "America/New_York" });
    await page.goto(`chrome-extension://${extensionId}/popup/index.html`);
    await page.getByTestId("task-suppression").click();
    await page.getByTestId("suppression-date").fill("2099-11-01");
    await page.getByTestId("suppression-time").fill("01:05");
    await page.getByTestId("suppression-save").click();
    const choices = page.getByTestId("suppression-candidate");
    await expect(choices).toHaveCount(2);
    await expect(choices.nth(1)).not.toBeChecked();
    await choices.nth(1).check();
    await page.getByTestId("suppression-save").click();
    await expect(page.getByTestId("task-item")).toHaveCount(1);
    expect((await readStored(page)).task).toMatchObject({
      reminderSuppressedUntil: "2099-11-01T06:05:00.000Z", revision: 2,
    });
  });

  test("日時変換機能がない場合は推測して設定しない", async ({ extensionContext, extensionId }) => {
    const page = await extensionContext.newPage();
    await seed(page, extensionId);
    await page.addInitScript(() => {
      Object.defineProperty(globalThis, "Temporal", { value: undefined, configurable: true });
    });
    await page.goto(`chrome-extension://${extensionId}/popup/index.html`);
    await page.getByTestId("task-suppression").click();
    await expect(page.getByTestId("suppression-error")).toContainText("日時の変換機能を利用できません");
    await page.getByTestId("suppression-date").fill("2099-12-01");
    await page.getByTestId("suppression-time").fill("10:30");
    await page.getByTestId("suppression-save").click();
    await expect(page.getByTestId("suppression-error")).toContainText("日時の変換機能を利用できません");
    expect((await readStored(page)).task).toMatchObject({ reminderSuppressedUntil: null, revision: 1 });
  });

  test("候補作成前のタイムゾーン変更も通知し、再確認まで保存しない", async ({
    extensionContext, extensionId,
  }) => {
    const page = await extensionContext.newPage();
    await seed(page, extensionId);
    const cdp = await extensionContext.newCDPSession(page);
    await cdp.send("Emulation.setTimezoneOverride", { timezoneId: "America/New_York" });
    await page.goto(`chrome-extension://${extensionId}/popup/index.html`);
    await page.getByTestId("task-suppression").click();
    await page.getByTestId("suppression-date").fill("2099-12-01");
    await page.getByTestId("suppression-time").fill("10:30");
    await cdp.send("Emulation.setTimezoneOverride", { timezoneId: "Etc/UTC" });
    await page.getByTestId("suppression-save").click();
    await expect(page.getByTestId("suppression-error")).toContainText("タイムゾーンが変わりました");
    expect((await readStored(page)).task).toMatchObject({ reminderSuppressedUntil: null, revision: 1 });
    await page.getByTestId("suppression-save").click();
    await expect(page.getByTestId("task-item")).toHaveCount(1);
    expect((await readStored(page)).task).toMatchObject({
      reminderSuppressedUntil: "2099-12-01T10:30:00.000Z", revision: 2,
    });
  });

  test("欠落・重複日時を検出し、タイムゾーン変更後は選択を破棄する", async ({
    extensionContext, extensionId,
  }) => {
    const page = await extensionContext.newPage();
    await seed(page, extensionId);
    const cdp = await extensionContext.newCDPSession(page);
    await cdp.send("Emulation.setTimezoneOverride", { timezoneId: "America/New_York" });
    await page.goto(`chrome-extension://${extensionId}/popup/index.html`);
    await page.getByTestId("task-suppression").click();
    await page.getByTestId("suppression-date").fill("2024-03-10");
    await page.getByTestId("suppression-time").fill("02:05");
    await page.getByTestId("suppression-save").click();
    await expect(page.getByTestId("suppression-error")).toContainText("存在しません");
    await expect(page.getByTestId("suppression-date")).toBeFocused();
    await page.getByTestId("suppression-date").fill("2024-11-03");
    await page.getByTestId("suppression-time").fill("01:05");
    await page.getByTestId("suppression-save").click();
    await expect(page.getByTestId("suppression-error")).toContainText("2回あります");
    const choices = page.getByTestId("suppression-candidate");
    await expect(choices).toHaveCount(2);
    await expect(choices.nth(0)).not.toBeChecked();
    await expect(choices.nth(1)).not.toBeChecked();
    await expect(page.getByText("UTC-04:00（2024-11-03T05:05:00.000Z）")).toBeVisible();
    await expect(page.getByText("UTC-05:00（2024-11-03T06:05:00.000Z）")).toBeVisible();
    await choices.nth(0).check();
    await cdp.send("Emulation.setTimezoneOverride", { timezoneId: "Etc/UTC" });
    await page.getByTestId("suppression-save").click();
    await expect(page.getByTestId("suppression-error")).toContainText("タイムゾーンが変わりました");
    await expect(choices).toHaveCount(0);
    await expect(page.getByTestId("suppression-date")).toHaveValue("2024-11-03");
    expect((await readStored(page)).task).toMatchObject({ reminderSuppressedUntil: null, revision: 1 });
  });

  test("編集中は画面と保存処理の両方で停止設定を拒否する", async ({
    extensionContext, extensionId,
  }) => {
    const first = await extensionContext.newPage();
    await seed(first, extensionId);
    await first.goto(`chrome-extension://${extensionId}/popup/index.html`);
    await first.getByTestId("task-edit").click();
    const second = await extensionContext.newPage();
    await second.goto(`chrome-extension://${extensionId}/popup/index.html`);
    await second.getByTestId("task-suppression").click();
    await expect(second.getByTestId("task-operation-error")).toContainText("進行中");
    await second.getByTestId("domain-filter").selectOption({ label: "example.com" });
    await second.getByTestId("domain-suppression").click();
    await expect(second.getByTestId("task-operation-error")).toContainText("進行中");
    const response: unknown = await second.evaluate(() => chrome.runtime.sendMessage({
      version: 1, requestId: "test", kind: "SUPPRESSION_UPDATE",
      payload: { kind: "task", id: "task-1", expectedRevision: 1, until: "2099-01-01T00:00:00.000Z" },
    }));
    expect(response).toEqual({ requestId: "test", ok: false, code: "OPERATION_ACTIVE" });
    const domainResponse: unknown = await second.evaluate(() => chrome.runtime.sendMessage({
      version: 1, requestId: "test-domain", kind: "SUPPRESSION_UPDATE",
      payload: {
        kind: "domain", hostname: "example.com", domain: { kind: "domain", value: "example.com" },
        until: "2099-01-01T00:00:00.000Z",
      },
    }));
    expect(domainResponse).toEqual({ requestId: "test-domain", ok: false, code: "OPERATION_ACTIVE" });
    expect((await readStored(second)).task).toMatchObject({ reminderSuppressedUntil: null, revision: 1 });
    expect((await readStored(second)).domains).toEqual([
      { hostname: "a.example.com", suppressedUntil: "2098-01-01T00:00:00.000Z" },
      { hostname: "b.example.com", suppressedUntil: "2098-02-01T00:00:00.000Z" },
      { hostname: "other.test", suppressedUntil: "2098-01-01T00:00:00.000Z" },
    ]);
  });
});
