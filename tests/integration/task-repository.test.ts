// @trace TS-002
// @trace TS-003
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDomainSuppressionRepository,
  deleteTask,
  getTask,
  listTasks,
  saveTask,
} from "../../src/background/task-repository";
import type { ImageRecord, TaskRecord } from "../../src/shared/task-types";

function task(id = "task-1"): TaskRecord {
  return {
    id,
    url: "https://example.com/a",
    hostname: "incorrect.example",
    name: "テスト",
    dueDate: null,
    detail: "",
    completed: false,
    createdAt: "2026-11-23T00:00:00.000Z",
    reminderSuppressedUntil: null,
    revision: 0,
  };
}

function image(id: string, taskId = "task-1", position = 0): ImageRecord {
  return { id, taskId, position, data: new Blob([id]) };
}

beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("task-management");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("DATABASE_BLOCKED"));
  });
});

describe("TS-002 タスクと画像の保存", () => {
  it("保存と編集で画像を差し替え、URLからホストを再計算する", async () => {
    const saved = await saveTask(task(), [image("old")], null);
    const edited = await saveTask(
      { ...saved, url: "https://new.example/path", name: "編集" },
      [image("new")],
      saved.revision,
    );
    expect(edited.hostname).toBe("new.example");
    expect(edited.revision).toBe(2);
    const result = await getTask(saved.id);
    expect(result?.task.name).toBe("編集");
    expect(result?.images.map((item) => item.id)).toEqual(["new"]);
  });

  it("競合する編集を拒否して先の変更と画像を保持する", async () => {
    const saved = await saveTask(task(), [image("old")], null);
    await saveTask({ ...saved, name: "先の変更" }, [image("first")], saved.revision);
    await expect(
      saveTask({ ...saved, name: "後の変更" }, [image("second")], saved.revision),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const result = await getTask(saved.id);
    expect(result?.task.name).toBe("先の変更");
    expect(result?.images.map((item) => item.id)).toEqual(["first"]);
  });

  it("不正なURLを拒否して保存済みデータを保持する", async () => {
    const saved = await saveTask(task(), [image("first")], null);
    await expect(saveTask({ ...saved, url: "invalid" }, [], saved.revision)).rejects.toMatchObject({
      code: "INVALID_TASK",
    });
    const result = await getTask(saved.id);
    expect(result?.task.url).toBe("https://example.com/a");
    expect(result?.images.map((item) => item.id)).toEqual(["first"]);
  });

  it("画像書き込みの失敗時は既存タスクと画像を保持する", async () => {
    const saved = await saveTask(task(), [image("first")], null);
    const put = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(() => {
      throw new DOMException("保存領域の空き容量が不足しています。", "QuotaExceededError");
    });
    try {
      await expect(
        saveTask({ ...saved, name: "変更" }, [image("second")], saved.revision),
      ).rejects.toMatchObject({ name: "QuotaExceededError" });
    } finally {
      put.mockRestore();
    }
    const result = await getTask(saved.id);
    expect(result?.task.name).toBe("テスト");
    expect(result?.images.map((item) => item.id)).toEqual(["first"]);
  });

  it("別タスクの画像IDを使用した変更を拒否し、両方を保持する", async () => {
    const first = await saveTask(task(), [image("first")], null);
    await saveTask(task("task-2"), [image("second", "task-2")], null);
    await expect(saveTask(first, [image("second")], first.revision)).rejects.toMatchObject({
      code: "INVALID_IMAGES",
    });
    expect((await getTask("task-1"))?.images.map((item) => item.id)).toEqual(["first"]);
    expect((await getTask("task-2"))?.images.map((item) => item.id)).toEqual(["second"]);
  });

  it("画像IDが別タスクのIDと重複する場合は保存を拒否する", async () => {
    const first = await saveTask(task(), [], null);
    await saveTask(task("task-2"), [], null);
    await expect(saveTask(first, [image("task-2")], first.revision)).rejects.toMatchObject({
      code: "INVALID_IMAGES",
    });
    expect((await getTask("task-1"))?.images).toEqual([]);
    expect((await getTask("task-2"))?.task.id).toBe("task-2");
  });

  it("削除時にタスクと画像をまとめて削除する", async () => {
    const saved = await saveTask(task(), [image("first")], null);
    await deleteTask(saved.id, saved.revision);
    expect(await getTask(saved.id)).toBeNull();
    expect(await listTasks()).toEqual([]);
    const replacement = await saveTask(task("task-2"), [image("first", "task-2")], null);
    expect((await getTask(replacement.id))?.images.map((item) => item.id)).toEqual(["first"]);
  });

  it("不整合な保存データを空の一覧として扱わない", async () => {
    await saveTask(task(), [], null);
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("task-management");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("tasks", "readwrite");
        transaction.objectStore("tasks").put({ id: "broken", name: "broken" });
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onabort = () => {
          database.close();
          reject(transaction.error);
        };
      };
    });
    await expect(listTasks()).rejects.toMatchObject({ code: "CORRUPT_DATA" });
  });
});

describe("TS-003 ドメイン停止設定の保存", () => {
  const firstEnd = "2099-01-01T00:00:00.000Z";
  const secondEnd = "2099-02-01T00:00:00.000Z";
  const separate = createDomainSuppressionRepository((hostname) => ({ kind: "host", value: hostname }));
  const grouped = createDomainSuppressionRepository((hostname) =>
    hostname === "example.com" || hostname.endsWith(".example.com")
      ? { kind: "domain", value: "example.com" }
      : { kind: "host", value: hostname },
  );

  it("現在同一対象の設定をすべて変更・解除し、別対象を保持する", async () => {
    await separate.updateDomainSuppression("a.example.com", firstEnd);
    await separate.updateDomainSuppression("b.example.com", firstEnd);
    await separate.updateDomainSuppression("other.test", firstEnd);
    await grouped.updateDomainSuppression("example.com", secondEnd);
    expect(await grouped.listDomainSuppressions()).toEqual([
      { hostname: "a.example.com", suppressedUntil: secondEnd },
      { hostname: "b.example.com", suppressedUntil: secondEnd },
      { hostname: "other.test", suppressedUntil: firstEnd },
    ]);
    await grouped.updateDomainSuppression("example.com", null);
    expect(await grouped.listDomainSuppressions()).toEqual([
      { hostname: "other.test", suppressedUntil: firstEnd },
    ]);
  });

  describe("TS-003 タスク停止設定の保存", () => {
    it("現在以前の停止終了日時を拒否し、直後の日時を受け付ける", async () => {
      const saved = await saveTask(task(), [], null);
      const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-23T12:00:00.000Z"));
      try {
        for (const end of ["2026-11-23T11:59:59.999Z", "2026-11-23T12:00:00.000Z"]) {
          await expect(
            saveTask({ ...saved, reminderSuppressedUntil: end }, [], saved.revision),
          ).rejects.toMatchObject({ code: "INVALID_SUPPRESSION" });
        }
        expect((await getTask(saved.id))?.task.reminderSuppressedUntil).toBeNull();
        const updated = await saveTask(
          { ...saved, reminderSuppressedUntil: "2026-11-23T12:00:00.001Z" },
          [],
          saved.revision,
        );
        expect(updated.reminderSuppressedUntil).toBe("2026-11-23T12:00:00.001Z");
      } finally {
        clock.mockRestore();
      }
    });
  });

  it("現在以前の終了日時を拒否して既存設定を保持する", async () => {
    await grouped.updateDomainSuppression("other.test", firstEnd);
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-23T12:00:00.000Z"));
    try {
      for (const end of ["2026-11-23T11:59:59.999Z", "2026-11-23T12:00:00.000Z"]) {
        await expect(grouped.updateDomainSuppression("other.test", end)).rejects.toMatchObject({
          code: "INVALID_SUPPRESSION",
        });
      }
      expect(await grouped.listDomainSuppressions()).toEqual([
        { hostname: "other.test", suppressedUntil: firstEnd },
      ]);
      await grouped.updateDomainSuppression("other.test", "2026-11-23T12:00:00.001Z");
    } finally {
      clock.mockRestore();
    }
    expect(await grouped.listDomainSuppressions()).toEqual([
      { hostname: "other.test", suppressedUntil: "2026-11-23T12:00:00.001Z" },
    ]);
  });

  it("別対象の同時更新で一方の設定を失わない", async () => {
    await Promise.all([
      grouped.updateDomainSuppression("a.example.com", firstEnd),
      grouped.updateDomainSuppression("other.test", secondEnd),
    ]);
    expect(await grouped.listDomainSuppressions()).toEqual([
      { hostname: "a.example.com", suppressedUntil: firstEnd },
      { hostname: "other.test", suppressedUntil: secondEnd },
    ]);
  });
});
