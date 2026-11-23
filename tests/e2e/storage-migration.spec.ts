// @trace TS-002
import { resolve } from "node:path";
import { build } from "vite";
import { expect, test } from "./extension-fixture";

test.describe("TS-002 保存データの版更新", () => {
  for (const legacyStore of [null, "edit_drafts", "capture_temp"] as const) {
    test(legacyStore === null ? "既存データを保持して版2に更新する" : `${legacyStore} があれば更新を中止する`, async ({
      extensionContext,
      extensionId,
    }) => {
      const output = await build({
        configFile: false,
        logLevel: "silent",
        build: {
          write: false,
          rollupOptions: {
            input: resolve("src/background/task-repository.ts"),
            preserveEntrySignatures: "strict",
            output: { format: "iife", name: "__testMigrationRepository" },
          },
        },
      });
      if (Array.isArray(output) || !("output" in output)) throw new Error("テスト用ビルドを取得できません。");
      const bundle = output.output.find((item) => item.type === "chunk");
      if (!bundle || bundle.type !== "chunk") throw new Error("テスト用コードを取得できません。");

      const page = await extensionContext.newPage();
      await page.goto(`chrome-extension://${extensionId}/options/index.html`);
      await page.evaluate(async (storeName) => {
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.open("task-management", 1);
          request.onupgradeneeded = () => {
            const database = request.result;
            const tasks = database.createObjectStore("tasks", { keyPath: "id" });
            const images = database.createObjectStore("images", { keyPath: "id" });
            images.createIndex("taskId", "taskId");
            const suppressions = database.createObjectStore("domain_suppressions", { keyPath: "hostname" });
            const drafts = database.createObjectStore("edit_drafts", { keyPath: "id" });
            const captures = database.createObjectStore("capture_temp", { keyPath: "requestId" });
            captures.createIndex("owner", ["owner.kind", "owner.id"]);
            tasks.put({
              id: "task-1", url: "https://example.com/", hostname: "example.com",
              name: "移行テスト", dueDate: null, detail: "", completed: false,
              createdAt: "2026-11-23T00:00:00.000Z", reminderSuppressedUntil: null, revision: 1,
            });
            images.put({ id: "image-1", taskId: "task-1", position: 0, data: new Blob(["image"]) });
            suppressions.put({ hostname: "example.com", suppressedUntil: "2099-01-01T00:00:00.000Z" });
            if (storeName === "edit_drafts") drafts.put({ id: "legacy", value: "保存済み" });
            if (storeName === "capture_temp") captures.put({ requestId: "legacy", value: "保存済み" });
          };
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            request.result.close();
            resolve();
          };
        });
      }, legacyStore);

      const debuggerSession = await extensionContext.newCDPSession(page);
      try {
        const result = await debuggerSession.send("Runtime.evaluate", {
          expression: bundle.code,
          allowUnsafeEvalBlockedByCSP: true,
        });
        if (result.exceptionDetails) throw new Error("テスト用コードを実行できません。");
      } finally {
        await debuggerSession.detach();
      }

      const result = await page.evaluate(async (storeName) => {
        const repository = (
          globalThis as typeof globalThis & {
            __testMigrationRepository: typeof import("../../src/background/task-repository");
          }
        ).__testMigrationRepository;
        let errorCode: string | null = null;
        try {
          await repository.listTasks();
        } catch (error) {
          if (!(error instanceof repository.TaskRepositoryError)) throw error;
          errorCode = error.code;
        }
        const stored = await new Promise<{ version: number; hasLock: boolean; records: unknown[] }>((resolve, reject) => {
          const request = indexedDB.open("task-management");
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const database = request.result;
            const names = ["tasks", "images", "domain_suppressions"];
            if (storeName) names.push(storeName);
            const transaction = database.transaction(names, "readonly");
            const requests = names.map((name) => transaction.objectStore(name).getAll());
            transaction.oncomplete = () => {
              const value = {
                version: database.version,
                hasLock: database.objectStoreNames.contains("active_operation"),
                records: requests.map((item) => item.result),
              };
              database.close();
              resolve(value);
            };
            transaction.onabort = () => {
              database.close();
              reject(transaction.error);
            };
          };
        });
        const imageRecords = stored.records[1];
        if (!Array.isArray(imageRecords) || imageRecords.length !== 1 ||
          !(imageRecords[0]?.data instanceof Blob)) {
          throw new Error("移行後の画像を確認できません。");
        }
        return { errorCode, ...stored, imageContent: await imageRecords[0].data.text() };
      }, legacyStore);

      expect(result.errorCode).toBe(legacyStore === null ? null : "LEGACY_TEMP_DATA");
      expect(result.version).toBe(legacyStore === null ? 2 : 1);
      expect(result.hasLock).toBe(legacyStore === null);
      expect(result.records[0]).toMatchObject([{ id: "task-1", name: "移行テスト" }]);
      expect(result.records[1]).toMatchObject([{ id: "image-1", taskId: "task-1" }]);
      expect(result.imageContent).toBe("image");
      expect(result.records[2]).toMatchObject([{ hostname: "example.com" }]);
      if (legacyStore) expect(result.records[3]).toMatchObject([{ value: "保存済み" }]);
      if (legacyStore === null) {
        const operationResult = await page.evaluate(async () => {
          const repository = (
            globalThis as typeof globalThis & {
              __testMigrationRepository: typeof import("../../src/background/task-repository");
            }
          ).__testMigrationRepository;
          const draft = {
            id: "draft-1", kind: "registration" as const, taskId: "task-2", baseRevision: null,
            fields: { name: "", url: "invalid", dueDate: "invalid", detail: "保存前" }, images: [],
          };
          const operation = await repository.startDraft(draft);
          await repository.saveDraft(operation, {
            ...draft,
            fields: { name: "新規", url: "https://example.com/new", dueDate: "", detail: "保存済み" },
          });
          const resumed = await repository.resumeDraft(operation);
          let staleCode: string | null = null;
          try {
            await repository.saveDraft(operation, draft);
          } catch (error) {
            if (!(error instanceof repository.TaskRepositoryError)) throw error;
            staleCode = error.code;
          }
          const restored = await repository.getActiveDraft();
          const saved = await repository.commitDraft(resumed);
          return { staleCode, restored, saved, activeAfterCommit: await repository.getActiveDraft() };
        });
        expect(operationResult.staleCode).toBe("STALE_OPERATION");
        expect(operationResult.restored?.draft.fields.detail).toBe("保存済み");
        expect(operationResult.saved).toMatchObject({ id: "task-2", name: "新規", revision: 1 });
        expect(operationResult.activeAfterCommit).toBeNull();
      }
    });
  }
});
