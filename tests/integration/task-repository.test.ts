// @trace TS-001
// @trace TS-002
// @trace TS-003
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  commitDraft,
  createDomainSuppressionRepository,
  deleteTask,
  discardDraft,
  getActiveDraft,
  getTask,
  listTasks,
  resumeDraft,
  saveDraft,
  saveTask,
  setTaskCompleted,
  setTaskSuppression,
  startDraft,
} from "../../src/background/task-repository";
import type { Draft, ImageRecord, TaskRecord } from "../../src/shared/task-types";

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

function registrationDraft(id = "draft-1", taskId = "task-1"): Draft {
  return {
    id,
    kind: "registration",
    taskId,
    baseRevision: null,
    fields: { name: "", url: "invalid", dueDate: "invalid", detail: "途中" },
    images: [],
  };
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

  it("完了状態の変更では画像を保持し、版が古い要求は拒否する", async () => {
    const saved = await saveTask(task(), [image("first")], null);
    const completed = await setTaskCompleted(saved.id, saved.revision, true);
    expect(completed).toMatchObject({ completed: true, revision: 2 });
    expect((await getTask(saved.id))?.images.map((item) => item.id)).toEqual(["first"]);
    await expect(setTaskCompleted(saved.id, saved.revision, false))
      .rejects.toMatchObject({ code: "CONFLICT" });
    expect((await getTask(saved.id))?.task.completed).toBe(true);
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

describe("TS-002 登録・編集の制限と再開", () => {
  it("並行開始は1件だけ成功し、対応する途中入力だけを残す", async () => {
    const first = registrationDraft();
    const second = registrationDraft("draft-2", "task-2");
    const results = await Promise.allSettled([startDraft(first), startDraft(second)]);
    const succeeded = results.filter((result) => result.status === "fulfilled");
    const failed = results.filter((result) => result.status === "rejected");
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ reason: { code: "OPERATION_ACTIVE" } });
    const winner = succeeded[0];
    if (!winner || winner.status !== "fulfilled") throw new Error("開始成功の結果がありません。");
    const active = await getActiveDraft();
    expect(active?.draft).toEqual(results[0]?.status === "fulfilled" ? first : second);
    expect(active?.operation).toEqual(winner.value);
  });

  it("再開と破棄後の旧世代を拒否し、最後に保存した入力を保持する", async () => {
    const draft = registrationDraft();
    const first = await startDraft(draft);
    const saved = { ...draft, fields: { ...draft.fields, detail: "保存済み" } };
    await saveDraft(first, saved);
    const resumed = await resumeDraft(first);
    expect(resumed).toEqual({ id: first.id, generation: first.generation + 1 });
    await expect(saveDraft(first, draft)).rejects.toMatchObject({ code: "STALE_OPERATION" });
    expect((await getActiveDraft())?.draft).toEqual(saved);
    await discardDraft(resumed);
    await expect(saveDraft(resumed, draft)).rejects.toMatchObject({ code: "STALE_OPERATION" });
    expect(await getActiveDraft()).toBeNull();
  });

  it("途中入力の不正値は保持し、確定失敗時に制限状態を解除しない", async () => {
    const draft = registrationDraft();
    const operation = await startDraft(draft);
    await expect(commitDraft(operation)).rejects.toMatchObject({ code: "INVALID_TASK" });
    expect((await getActiveDraft())?.draft).toEqual(draft);
    expect(await listTasks()).toEqual([]);
    await saveDraft(operation, {
      ...draft,
      fields: { name: "登録", url: "https://example.com/a", dueDate: "", detail: "" },
      images: [image("image-1")],
    });
    const saved = await commitDraft(operation);
    expect(saved.hostname).toBe("example.com");
    expect((await getTask(saved.id))?.images.map((item) => item.id)).toEqual(["image-1"]);
    expect(await getActiveDraft()).toBeNull();
  });

  it("編集中の他の変更を拒否し、取消後に再び変更できる", async () => {
    const saved = await saveTask(task(), [], null);
    const operation = await startDraft({
      ...registrationDraft(),
      kind: "edit",
      baseRevision: saved.revision,
    });
    const suppressions = createDomainSuppressionRepository((hostname) => ({ kind: "host", value: hostname }));
    await expect(saveTask({ ...saved, completed: true }, [], saved.revision))
      .rejects.toMatchObject({ code: "OPERATION_ACTIVE" });
    await expect(setTaskCompleted(saved.id, saved.revision, true))
      .rejects.toMatchObject({ code: "OPERATION_ACTIVE" });
    await expect(setTaskSuppression(saved.id, saved.revision, "2099-01-01T00:00:00.000Z"))
      .rejects.toMatchObject({ code: "OPERATION_ACTIVE" });
    await expect(deleteTask(saved.id, saved.revision))
      .rejects.toMatchObject({ code: "OPERATION_ACTIVE" });
    await expect(suppressions.updateDomainSuppression("example.com", "2099-01-01T00:00:00.000Z"))
      .rejects.toMatchObject({ code: "OPERATION_ACTIVE" });
    expect((await getTask(saved.id))?.task).toEqual(saved);
    await discardDraft(operation);
    await deleteTask(saved.id, saved.revision);
    expect(await getTask(saved.id)).toBeNull();
  });

  it("画像の書き込み失敗時は既存データと途中入力を保持する", async () => {
    const saved = await saveTask(task(), [image("old")], null);
    const draft: Draft = {
      ...registrationDraft(),
      kind: "edit",
      baseRevision: saved.revision,
      fields: { name: "編集後", url: saved.url, dueDate: "", detail: "" },
      images: [image("new")],
    };
    const operation = await startDraft(draft);
    const put = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(() => {
      throw new DOMException("保存領域の空き容量が不足しています。", "QuotaExceededError");
    });
    try {
      await expect(commitDraft(operation)).rejects.toMatchObject({ name: "QuotaExceededError" });
    } finally {
      put.mockRestore();
    }
    expect(await getTask(saved.id)).toMatchObject({
      task: { name: "テスト", revision: saved.revision },
      images: [{ id: "old" }],
    });
    expect((await getActiveDraft())?.draft).toEqual(draft);
    const updated = await commitDraft(operation);
    expect(updated).toMatchObject({ name: "編集後", revision: saved.revision + 1 });
    expect((await getTask(saved.id))?.images.map((item) => item.id)).toEqual(["new"]);
    expect(await getActiveDraft()).toBeNull();
  });

  it("別タスクや画像と衝突する一時データを拒否する", async () => {
    await saveTask(task(), [image("old")], null);
    await expect(startDraft(registrationDraft("old", "new-task")))
      .rejects.toMatchObject({ code: "INVALID_DRAFT" });
    const draft = registrationDraft("draft-2", "task-2");
    const operation = await startDraft(draft);
    await expect(saveDraft(operation, { ...draft, images: [image("old", "task-2")] }))
      .rejects.toMatchObject({ code: "INVALID_IMAGES" });
    expect((await getActiveDraft())?.draft).toEqual(draft);
  });

  it("再開時に完了済み撮影結果を引き継ぎ、未完了結果を無効化する", async () => {
    const draft = registrationDraft();
    const operation = await startDraft(draft);
    async function captures(write: boolean): Promise<unknown[]> {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open("task-management");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("capture_temp", write ? "readwrite" : "readonly");
          const store = transaction.objectStore("capture_temp");
          if (write) {
            for (const status of ["pending", "ready", "error"]) {
              store.put({
                requestId: status,
                owner: { kind: "registration", id: draft.id },
                operation,
                status,
              });
            }
          }
          const all = store.getAll();
          transaction.oncomplete = () => {
            database.close();
            resolve(all.result);
          };
          transaction.onabort = () => {
            database.close();
            reject(transaction.error);
          };
        };
      });
    }
    await captures(true);
    const resumed = await resumeDraft(operation);
    expect(await captures(false)).toMatchObject([
      { requestId: "error", operation: resumed },
      { requestId: "ready", operation: resumed },
    ]);
    await discardDraft(resumed);
    expect(await captures(false)).toEqual([]);
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
    it("設定・解除で画像を保持し、古い版と現在以前の日時を拒否する", async () => {
      const saved = await saveTask(task(), [image("first")], null);
      const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-23T12:00:00.000Z"));
      try {
        for (const until of ["2026-11-23T11:59:59.999Z", "2026-11-23T12:00:00.000Z"]) {
          await expect(setTaskSuppression(saved.id, saved.revision, until))
            .rejects.toMatchObject({ code: "INVALID_SUPPRESSION" });
        }
        const updated = await setTaskSuppression(saved.id, saved.revision, "2026-11-23T12:00:00.001Z");
        await expect(setTaskSuppression(saved.id, saved.revision, null))
          .rejects.toMatchObject({ code: "CONFLICT" });
        const cleared = await setTaskSuppression(saved.id, updated.revision, null);
        expect(cleared.reminderSuppressedUntil).toBeNull();
        const result = await getTask(saved.id);
        expect(result?.images.map((item) => item.id)).toEqual(["first"]);
      } finally {
        clock.mockRestore();
      }
    });

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
