// @trace TS-002 TS-004
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { expect, test } from "./extension-fixture";

async function seed(page: Page, extensionId: string): Promise<void> {
  await page.goto(`chrome-extension://${extensionId}/options/index.html`);
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("task-management", 2);
      request.onupgradeneeded = () => {
        const database = request.result;
        const tasks = database.createObjectStore("tasks", { keyPath: "id" });
        const images = database.createObjectStore("images", { keyPath: "id" });
        images.createIndex("taskId", "taskId");
        database.createObjectStore("domain_suppressions", { keyPath: "hostname" });
        database.createObjectStore("edit_drafts", { keyPath: "id" });
        database.createObjectStore("capture_temp", { keyPath: "requestId" })
          .createIndex("owner", ["owner.kind", "owner.id"]);
        database.createObjectStore("active_operation");
        tasks.put({
          id: "task-1", url: "https://example.com/old", hostname: "example.com",
          name: "元のタスク", dueDate: null, detail: "元の詳細", completed: false,
          createdAt: "2026-01-01T00:00:00.000Z", reminderSuppressedUntil: null, revision: 1,
        });
        const bytes = Uint8Array.from(
          atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/r9sAAAAASUVORK5CYII="),
          (character) => character.charCodeAt(0),
        );
        images.put({ id: "image-1", taskId: "task-1", position: 0, data: new Blob([bytes], { type: "image/png" }) });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
    });
  });
  await page.goto(`chrome-extension://${extensionId}/popup/index.html`);
  await expect(page.getByTestId("task-item")).toHaveCount(1);
}

async function readStored(page: Page): Promise<{ task: unknown; imageCount: number }> {
  return page.evaluate(async () => new Promise((resolve, reject) => {
    const request = indexedDB.open("task-management");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(["tasks", "images"], "readonly");
      const task = transaction.objectStore("tasks").get("task-1");
      const images = transaction.objectStore("images").count();
      transaction.oncomplete = () => {
        database.close();
        resolve({ task: task.result, imageCount: images.result });
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error);
      };
    };
  }));
}

test.describe("TS-002 一覧からのタスク管理", () => {
  test("画像を保持して編集し、不正なURLでは確定しない", async ({ extensionContext, extensionId }) => {
    const page = await extensionContext.newPage();
    await seed(page, extensionId);
    await page.getByTestId("task-edit").click();
    await expect(page.getByTestId("edit-name")).toHaveValue("元のタスク");
    await expect(page.getByAltText("画像1")).toBeVisible();
    const originalImage = await page.getByAltText("画像1").evaluate(async (element) => {
      if (!(element instanceof HTMLImageElement)) throw new Error("画像を取得できません。");
      return Array.from(new Uint8Array(await (await fetch(element.src)).arrayBuffer()));
    });
    await page.getByTestId("edit-name").fill("変更後");
    await page.getByTestId("edit-url").fill("invalid");
    await expect(page.getByTestId("draft-status")).toHaveText("保存済み");
    await page.getByTestId("edit-save").click();
    await expect(page.getByText("有効なURLを入力してください。")).toBeVisible();
    expect(await readStored(page)).toMatchObject({
      task: { name: "元のタスク", url: "https://example.com/old", revision: 1 }, imageCount: 1,
    });
    await page.getByTestId("edit-url").fill("https://new.example/path");
    await page.getByTestId("edit-due-date").fill("2027-01-31");
    await page.getByTestId("edit-detail").fill("更新した詳細");
    await expect(page.getByTestId("draft-status")).toHaveText("保存済み");
    await page.getByTestId("edit-save").click();
    await expect(page.getByTestId("task-item")).toContainText("変更後");
    await expect(page.getByTestId("task-item")).toContainText("new.example");
    expect(await readStored(page)).toMatchObject({
      task: {
        name: "変更後", url: "https://new.example/path", hostname: "new.example",
        dueDate: "2027-01-31", detail: "更新した詳細", revision: 2,
      },
      imageCount: 1,
    });
    await page.reload();
    await expect(page.getByTestId("task-item")).toContainText("変更後");
    await page.getByTestId("task-edit").click();
    await expect(page.getByAltText("画像1")).toBeVisible();
    const restoredImage = await page.getByAltText("画像1").evaluate(async (element) => {
      if (!(element instanceof HTMLImageElement)) throw new Error("画像を取得できません。");
      return Array.from(new Uint8Array(await (await fetch(element.src)).arrayBuffer()));
    });
    expect(restoredImage).toEqual(originalImage);
    await page.getByTestId("edit-cancel").click();
    await expect(page.getByTestId("task-item")).toContainText("変更後");
  });

  test("画像の削除を取消または保存した場合に登録済み画像を正しく扱う", async ({ extensionContext, extensionId }) => {
    const page = await extensionContext.newPage();
    await seed(page, extensionId);
    await page.getByTestId("task-edit").click();
    await page.getByTestId("remove-image-0").click();
    await expect(page.getByTestId("draft-status")).toHaveText("保存済み");
    await page.getByTestId("edit-cancel").click();
    expect((await readStored(page)).imageCount).toBe(1);
    await page.getByTestId("task-edit").click();
    await expect(page.getByAltText("画像1")).toBeVisible();
    await page.getByTestId("remove-image-0").click();
    await expect(page.getByTestId("draft-status")).toHaveText("保存済み");
    await page.getByTestId("edit-save").click();
    await expect(page.getByTestId("task-item")).toHaveCount(1);
    expect((await readStored(page)).imageCount).toBe(0);
  });

  test("確定途中の保存失敗では元のタスクと画像、編集中の入力を保持する", async ({
    extensionContext, extensionId,
  }) => {
    const page = await extensionContext.newPage();
    await seed(page, extensionId);
    await page.getByTestId("task-edit").click();
    await page.getByTestId("edit-name").fill("変更後");
    await page.getByTestId("remove-image-0").click();
    await expect(page.getByTestId("draft-status")).toHaveText("保存済み");
    const worker = extensionContext.serviceWorkers()[0];
    if (!worker) throw new Error("Service Worker が見つかりません。");
    await worker.evaluate(() => {
      const state = globalThis as typeof globalThis & { restoreTestPut?: () => void };
      const original = IDBObjectStore.prototype.put;
      state.restoreTestPut = () => { IDBObjectStore.prototype.put = original; };
      IDBObjectStore.prototype.put = new Proxy(original, {
        apply(target, receiver: unknown, args: unknown[]) {
          if (receiver instanceof IDBObjectStore && receiver.name === "tasks") {
            throw new DOMException("保存領域の空き容量が不足しています。", "QuotaExceededError");
          }
          return Reflect.apply(target, receiver, args);
        },
      });
    });
    try {
      await page.getByTestId("edit-save").click();
      await expect(page.getByTestId("editor-error")).toContainText("空き容量が不足");
      await expect(page.getByTestId("edit-name")).toHaveValue("変更後");
      expect(await readStored(page)).toMatchObject({
        task: { name: "元のタスク", revision: 1 }, imageCount: 1,
      });
    } finally {
      await worker.evaluate(() => {
        const state = globalThis as typeof globalThis & { restoreTestPut?: () => void };
        state.restoreTestPut?.();
        delete state.restoreTestPut;
      });
    }
    await page.getByTestId("edit-save").click();
    await expect(page.getByTestId("task-item")).toContainText("変更後");
    expect(await readStored(page)).toMatchObject({ task: { name: "変更後", revision: 2 }, imageCount: 0 });
  });

  test("途中入力の保存失敗を通知し、未保存の入力を保持する", async ({ extensionContext, extensionId }) => {
    const page = await extensionContext.newPage();
    await seed(page, extensionId);
    await page.getByTestId("task-edit").click();
    const worker = extensionContext.serviceWorkers()[0];
    if (!worker) throw new Error("Service Worker が見つかりません。");
    await worker.evaluate(() => {
      const state = globalThis as typeof globalThis & { restoreTestPut?: () => void };
      const original = IDBObjectStore.prototype.put;
      state.restoreTestPut = () => { IDBObjectStore.prototype.put = original; };
      IDBObjectStore.prototype.put = new Proxy(original, {
        apply(target, receiver: unknown, args: unknown[]) {
          if (receiver instanceof IDBObjectStore && receiver.name === "edit_drafts") {
            throw new DOMException("保存領域の空き容量が不足しています。", "QuotaExceededError");
          }
          return Reflect.apply(target, receiver, args);
        },
      });
    });
    try {
      await page.getByTestId("edit-name").fill("未保存の変更");
      await expect(page.getByTestId("draft-status")).toHaveText("保存失敗");
      await expect(page.getByTestId("editor-error")).toContainText("空き容量が不足");
      await page.getByTestId("edit-save").click();
      await expect(page.getByTestId("edit-name")).toHaveValue("未保存の変更");
      expect(await readStored(page)).toMatchObject({ task: { name: "元のタスク", revision: 1 }, imageCount: 1 });
    } finally {
      await worker.evaluate(() => {
        const state = globalThis as typeof globalThis & { restoreTestPut?: () => void };
        state.restoreTestPut?.();
        delete state.restoreTestPut;
      });
    }
    await page.getByTestId("edit-name").fill("再保存した変更");
    await expect(page.getByTestId("draft-status")).toHaveText("保存済み");
    await page.getByTestId("edit-save").click();
    await expect(page.getByTestId("task-item")).toContainText("再保存した変更");
  });

  test("編集中に保存済みタスクの版が変わると入力を保持して上書きを拒否する", async ({
    extensionContext, extensionId,
  }) => {
    const page = await extensionContext.newPage();
    await seed(page, extensionId);
    await page.getByTestId("task-edit").click();
    await page.getByTestId("edit-name").fill("編集中の変更");
    await expect(page.getByTestId("draft-status")).toHaveText("保存済み");

    await page.evaluate(async () => new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("task-management");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("tasks", "readwrite");
        const store = transaction.objectStore("tasks");
        const get = store.get("task-1");
        get.onsuccess = () => {
          const task: unknown = get.result;
          if (typeof task !== "object" || task === null) {
            transaction.abort();
            return;
          }
          store.put({ ...task, name: "別の変更", revision: 2 });
        };
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onabort = () => {
          database.close();
          reject(transaction.error ?? new Error("試験データの変更に失敗しました。"));
        };
      };
    }));

    await page.getByTestId("edit-save").click();
    await expect(page.getByTestId("editor-error")).toContainText("保存済みデータが変更されています");
    await expect(page.getByTestId("edit-name")).toHaveValue("編集中の変更");
    expect(await readStored(page)).toMatchObject({
      task: { name: "別の変更", revision: 2 }, imageCount: 1,
    });

    await page.close();
    const reopened = await extensionContext.newPage();
    await reopened.goto(`chrome-extension://${extensionId}/popup/index.html`);
    await reopened.getByTestId("draft-resume").click();
    await expect(reopened.getByTestId("edit-name")).toHaveValue("編集中の変更");
    await reopened.getByTestId("edit-save").click();
    await expect(reopened.getByTestId("editor-error")).toContainText("保存済みデータが変更されています");
    expect(await readStored(reopened)).toMatchObject({
      task: { name: "別の変更", revision: 2 }, imageCount: 1,
    });
  });

  test("別画面への再開は旧画面の遅延保存を拒否し、保存済み入力を復元する", async ({
    extensionContext, extensionId,
  }) => {
    const first = await extensionContext.newPage();
    await seed(first, extensionId);
    await first.getByTestId("task-edit").click();
    await first.getByTestId("edit-url").fill("不正なURL");
    await first.getByTestId("edit-due-date").fill("不正な期限");
    await expect(first.getByTestId("draft-status")).toHaveText("保存済み");

    const second = await extensionContext.newPage();
    await second.goto(`chrome-extension://${extensionId}/popup/index.html`);
    await expect(second.getByTestId("active-draft")).toBeVisible();
    for (const action of ["task-edit", "task-toggle", "task-delete"]) {
      await second.getByTestId(action).click();
      await expect(second.getByTestId("task-operation-error")).toContainText("進行中");
    }
    await second.getByTestId("draft-resume").click();
    await expect(second.getByTestId("edit-url")).toHaveValue("不正なURL");
    await expect(second.getByTestId("edit-due-date")).toHaveValue("不正な期限");
    await first.getByTestId("edit-name").fill("遅延した変更");
    await expect(first.getByTestId("draft-status")).toHaveText("保存失敗");
    await expect(first.getByTestId("editor-error")).toContainText("別の画面");
    await second.getByTestId("edit-save").click();
    await expect(second.getByText("有効なURLを入力してください。")).toBeVisible();
    await expect(second.getByText("有効な日付を入力してください。")).toBeVisible();
    expect(await readStored(second)).toMatchObject({
      task: { name: "元のタスク", revision: 1 }, imageCount: 1,
    });
    await second.close();
    const reopened = await extensionContext.newPage();
    await reopened.goto(`chrome-extension://${extensionId}/popup/index.html`);
    await reopened.getByTestId("draft-resume").click();
    await expect(reopened.getByTestId("edit-url")).toHaveValue("不正なURL");
    await expect(reopened.getByTestId("edit-name")).toHaveValue("元のタスク");
    await reopened.getByTestId("edit-cancel").click();
    await expect(reopened.getByTestId("active-draft")).toHaveCount(0);
    await reopened.getByTestId("task-edit").click();
    await expect(reopened.getByTestId("edit-name")).toHaveValue("元のタスク");
    await reopened.getByTestId("edit-cancel").click();
  });

  test("ブラウザー再起動後もタスクと画像、編集中の入力と制限を保持する", async ({ headless }, testInfo) => {
    const profile = testInfo.outputPath("restart-profile");
    const extensionPath = resolve("dist");
    let context: BrowserContext | undefined;
    const launch = () => chromium.launchPersistentContext(profile, {
      channel: "chromium",
      headless,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    const getExtensionId = async (browserContext: BrowserContext): Promise<string> => {
      const worker = browserContext.serviceWorkers()[0] ?? await browserContext.waitForEvent("serviceworker");
      return new URL(worker.url()).host;
    };

    try {
      context = await launch();
      const extensionId = await getExtensionId(context);
      const page = await context.newPage();
      await seed(page, extensionId);
      await page.getByTestId("task-edit").click();
      await expect(page.getByAltText("画像1")).toBeVisible();
      const image = await page.getByAltText("画像1").evaluate(async (element) => {
        if (!(element instanceof HTMLImageElement)) throw new Error("画像を取得できません。");
        return Array.from(new Uint8Array(await (await fetch(element.src)).arrayBuffer()));
      });
      await page.getByTestId("edit-name").fill("再起動前の途中入力");
      await page.getByTestId("edit-detail").fill("保存した詳細");
      await expect(page.getByTestId("draft-status")).toHaveText("保存済み");
      await context.close();
      context = undefined;

      context = await launch();
      expect(await getExtensionId(context)).toBe(extensionId);
      const reopened = await context.newPage();
      await reopened.goto(`chrome-extension://${extensionId}/popup/index.html`);
      await expect(reopened.getByTestId("task-item")).toContainText("元のタスク");
      await expect(reopened.getByTestId("active-draft")).toBeVisible();
      const savedImage = await reopened.evaluate(async () => {
        const blob = await new Promise<Blob>((resolve, reject) => {
          const request = indexedDB.open("task-management");
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const database = request.result;
            const transaction = database.transaction("images", "readonly");
            const imageRequest = transaction.objectStore("images").get("image-1");
            transaction.oncomplete = () => {
              const value: unknown = imageRequest.result;
              database.close();
              if (typeof value !== "object" || value === null || !("data" in value) ||
                !(value.data instanceof Blob)) {
                reject(new Error("保存済み画像を取得できません。"));
                return;
              }
              resolve(value.data);
            };
            transaction.onabort = () => {
              database.close();
              reject(transaction.error);
            };
          };
        });
        return Array.from(new Uint8Array(await blob.arrayBuffer()));
      });
      expect(savedImage).toEqual(image);
      await reopened.getByTestId("task-toggle").click();
      await expect(reopened.getByTestId("task-operation-error")).toContainText("進行中");
      await reopened.getByTestId("draft-resume").click();
      await expect(reopened.getByTestId("edit-name")).toHaveValue("再起動前の途中入力");
      await expect(reopened.getByTestId("edit-detail")).toHaveValue("保存した詳細");
      await expect(reopened.getByAltText("画像1")).toBeVisible();
      const restoredImage = await reopened.getByAltText("画像1").evaluate(async (element) => {
        if (!(element instanceof HTMLImageElement)) throw new Error("画像を取得できません。");
        return Array.from(new Uint8Array(await (await fetch(element.src)).arrayBuffer()));
      });
      expect(restoredImage).toEqual(image);
      await reopened.getByTestId("edit-cancel").click();
      await expect(reopened.getByTestId("active-draft")).toHaveCount(0);
      await reopened.getByTestId("task-toggle").click();
      await expect(reopened.getByTestId("task-toggle")).toHaveText("未完了にする");
    } finally {
      if (context) await context.close();
      await rm(profile, { recursive: true, force: true });
    }
  });

  test("完了状態を保存し、削除の取消と確認で画像も含めて扱う", async ({ extensionContext, extensionId }) => {
    const page = await extensionContext.newPage();
    await seed(page, extensionId);
    await page.getByTestId("task-toggle").click();
    await expect(page.getByTestId("task-toggle")).toHaveText("未完了にする");
    await page.reload();
    await expect(page.getByTestId("task-toggle")).toHaveText("未完了にする");
    expect(await readStored(page)).toMatchObject({ task: { completed: true }, imageCount: 1 });
    await page.getByTestId("task-toggle").click();
    await expect(page.getByTestId("task-toggle")).toHaveText("完了にする");
    await page.getByTestId("task-delete").click();
    await expect(page.getByTestId("confirm-cancel")).toBeFocused();
    await expect(page.getByRole("dialog")).toContainText("画像も削除されます。");
    await page.getByTestId("confirm-cancel").click();
    await expect(page.getByTestId("task-delete")).toBeFocused();
    expect(await readStored(page)).toMatchObject({ task: { name: "元のタスク" }, imageCount: 1 });
    await page.getByTestId("task-delete").click();
    await page.getByTestId("confirm-apply").click();
    await expect(page.getByTestId("task-empty")).toHaveText("タスクはありません。");
    expect(await readStored(page)).toEqual({ task: undefined, imageCount: 0 });
  });
});
