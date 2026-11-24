// @trace TS-002 TS-004
import { attachPopupTarget, expect, test } from "./extension-fixture";

test.describe("TS-002 一覧表示と取得エラー", () => {
  test("旧形式の一時データを移行できない場合、空一覧とせず通知する", async ({
    extensionContext,
    extensionId,
  }) => {
    const page = await extensionContext.newPage();
    await page.goto(`chrome-extension://${extensionId}/options/index.html`);
    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("task-management", 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          database.createObjectStore("tasks", { keyPath: "id" });
          database.createObjectStore("images", { keyPath: "id" }).createIndex("taskId", "taskId");
          database.createObjectStore("domain_suppressions", { keyPath: "hostname" });
          database.createObjectStore("edit_drafts", { keyPath: "id" }).put({ id: "legacy" });
          database.createObjectStore("capture_temp", { keyPath: "requestId" })
            .createIndex("owner", ["owner.kind", "owner.id"]);
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          request.result.close();
          resolve();
        };
      });
    });
    await page.goto(`chrome-extension://${extensionId}/popup/index.html`);
    const error = page.getByTestId("task-error");
    const message = "以前の途中入力または撮影結果を移行できないため、タスクを読み込めません。データは削除されていません。";
    await expect(error).toHaveText(message);
    await expect(error).toBeFocused();
    await expect(page.getByTestId("task-loading")).toHaveCount(0);
    await page.getByTestId("task-retry").click();
    await expect(error).toHaveText(message);
    await expect(error).toBeFocused();
  });

  test("版更新の待機を通知し、接続を閉じた後の再試行で既存データを表示する", async ({
    extensionContext,
    extensionId,
  }) => {
    const holder = await extensionContext.newPage();
    await holder.goto(`chrome-extension://${extensionId}/options/index.html`);
    await holder.evaluate(async () => new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("task-management", 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        const tasks = database.createObjectStore("tasks", { keyPath: "id" });
        database.createObjectStore("images", { keyPath: "id" }).createIndex("taskId", "taskId");
        database.createObjectStore("domain_suppressions", { keyPath: "hostname" });
        database.createObjectStore("edit_drafts", { keyPath: "id" });
        database.createObjectStore("capture_temp", { keyPath: "requestId" })
          .createIndex("owner", ["owner.kind", "owner.id"]);
        tasks.put({
          id: "task-1", url: "https://example.com/", hostname: "example.com",
          name: "保存済みタスク", dueDate: null, detail: "", completed: false,
          createdAt: "2026-01-01T00:00:00.000Z", reminderSuppressedUntil: null, revision: 1,
        });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        (globalThis as typeof globalThis & { heldTestDatabase?: IDBDatabase }).heldTestDatabase = request.result;
        resolve();
      };
    }));

    const popup = await extensionContext.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
    await expect(popup.getByTestId("task-error")).toContainText("保存データの更新を待っています");
    await expect(popup.getByTestId("task-empty")).toHaveCount(0);

    await holder.evaluate(() => {
      const state = globalThis as typeof globalThis & { heldTestDatabase?: IDBDatabase };
      if (!state.heldTestDatabase) throw new Error("試験用の接続が見つかりません。");
      state.heldTestDatabase.close();
      delete state.heldTestDatabase;
    });
    await popup.getByTestId("task-retry").click();
    await expect(popup.getByTestId("task-item")).toHaveCount(1);
    await expect(popup.getByTestId("task-item")).toContainText("保存済みタスク");
    const version = await holder.evaluate(async () => new Promise<number>((resolve, reject) => {
      const request = indexedDB.open("task-management");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const result = database.version;
        database.close();
        resolve(result);
      };
    }));
    expect(version).toBe(2);
  });

  test("拡張機能アイコンのポップアップで空の一覧を表示する", async ({
    extensionContext,
    extensionId,
  }) => {
    const worker = extensionContext.serviceWorkers()[0];
    if (!worker) throw new Error("拡張機能の Service Worker が見つかりません。");
    await worker.evaluate(() => chrome.action.openPopup());
    const popup = await attachPopupTarget(extensionContext, `chrome-extension://${extensionId}/popup/index.html`);
    try {
      await expect.poll(() =>
        popup.evaluate("document.querySelector('[data-testid=\"task-empty\"]')?.textContent"),
      ).toBe("タスクはありません。");
    } finally {
      await popup.close();
    }
  });

  test("保存済みタスクを期限順に表示し、状態とドメインで絞り込む", async ({
    extensionContext,
    extensionId,
  }) => {
    const page = await extensionContext.newPage();
    await page.goto(`chrome-extension://${extensionId}/options/index.html`);
    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("task-management", 2);
        request.onupgradeneeded = () => {
          const database = request.result;
          const tasks = database.createObjectStore("tasks", { keyPath: "id" });
          database.createObjectStore("images", { keyPath: "id" }).createIndex("taskId", "taskId");
          database.createObjectStore("domain_suppressions", { keyPath: "hostname" });
          database.createObjectStore("edit_drafts", { keyPath: "id" });
          database.createObjectStore("capture_temp", { keyPath: "requestId" })
            .createIndex("owner", ["owner.kind", "owner.id"]);
          database.createObjectStore("active_operation");
          const base = {
            detail: "", createdAt: "2026-01-01T00:00:00.000Z",
            reminderSuppressedUntil: null, revision: 1,
          };
          tasks.put({
            ...base, id: "first", url: "https://a.example.com/", hostname: "a.example.com",
            name: "期限あり", dueDate: "2020-01-01", completed: false,
          });
          tasks.put({
            ...base, id: "second", url: "https://other.test/", hostname: "other.test",
            name: "完了", dueDate: null, completed: true,
          });
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          request.result.close();
          resolve();
        };
      });
    });
    await page.goto(`chrome-extension://${extensionId}/popup/index.html`);
    const items = page.getByTestId("task-item");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText("期限あり");
    await expect(items.nth(0)).toContainText("期限超過");
    await expect(items.nth(1)).toContainText("完了");
    await page.getByTestId("completion-filter").selectOption("completed");
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText("完了");
    await page.getByTestId("domain-filter").selectOption({ label: "example.com" });
    await expect(page.getByTestId("task-empty")).toHaveText("条件に一致するタスクはありません。");
    await page.getByTestId("completion-filter").selectOption("open");
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText("期限あり");
  });
});
