// @trace TS-002
import { describe, expect, it } from "vitest";
import { createTaskListView, isTaskOverdue, sortTasks } from "../../src/shared/task-display";
import type { DomainKey } from "../../src/shared/domain-types";
import type { TaskRecord } from "../../src/shared/task-types";

describe("TS-002 期限超過の判定", () => {
  const now = new Date(2026, 10, 23, 12);

  it.each([
    ["前日の未完了", "2026-11-22", false, true],
    ["当日の未完了", "2026-11-23", false, false],
    ["翌日の未完了", "2026-11-24", false, false],
    ["期限のない未完了", null, false, false],
    ["前日の完了済み", "2026-11-22", true, false],
  ])("%sを判定する", (_label, dueDate, completed, expected) => {
    expect(isTaskOverdue({ dueDate, completed }, now)).toBe(expected);
  });

  describe("TS-002 タスク一覧の絞り込み", () => {
    const task = (id: string, hostname: string, completed: boolean, dueDate: string | null): TaskRecord => ({
      id,
      url: `https://${hostname}/`,
      hostname,
      name: id,
      dueDate,
      detail: "",
      completed,
      createdAt: "2026-11-23T00:00:00.000Z",
      reminderSuppressedUntil: null,
      revision: 1,
    });
    const resolve = (hostname: string): DomainKey =>
      hostname.endsWith(".example.com")
        ? { kind: "domain", value: "example.com" }
        : { kind: "host", value: hostname };

    it("完了状態とドメインを組み合わせて絞り込み、期限順に並べる", () => {
      const tasks = [
        task("late", "a.example.com", false, "2026-12-01"),
        task("completed", "b.example.com", true, null),
        task("other", "other.test", false, null),
        task("early", "b.example.com", false, "2026-11-24"),
      ];
      const view = createTaskListView(
        tasks,
        { completion: "open", domain: { kind: "domain", value: "example.com" } },
        resolve,
      );
      expect(view.tasks.map((item) => item.id)).toEqual(["early", "late"]);
      expect(view.emptyState).toBeNull();
      expect(tasks.map((item) => item.id)).toEqual(["late", "completed", "other", "early"]);
    });

    it("同じ文字列の異なる種別を区別し、消えた選択肢を保持する", () => {
      const tasks = [task("host", "example.com", false, null), task("domain", "a.example.com", false, null)];
      const view = createTaskListView(
        tasks,
        { completion: "all", domain: { kind: "host", value: "missing.test" } },
        resolve,
      );
      expect(view.domains).toEqual([
        { key: { kind: "domain", value: "example.com" }, label: "example.com（ドメイン）", missing: false },
        { key: { kind: "host", value: "example.com" }, label: "example.com（ホスト）", missing: false },
        { key: { kind: "host", value: "missing.test" }, label: "missing.test（対象なし）", missing: true },
      ]);
      expect(view.tasks).toEqual([]);
      expect(view.emptyState).toBe("no-matches");
      const hostView = createTaskListView(
        tasks,
        { completion: "all", domain: { kind: "host", value: "example.com" } },
        resolve,
      );
      expect(hostView.tasks.map((item) => item.id)).toEqual(["host"]);
    });

    it("保存タスクがない場合と絞り込み結果がない場合を区別する", () => {
      expect(createTaskListView([], { completion: "all", domain: null }, resolve).emptyState).toBe("no-tasks");
      const view = createTaskListView(
        [task("open", "other.test", false, null)],
        { completion: "completed", domain: null },
        resolve,
      );
      expect(view.emptyState).toBe("no-matches");
    });

    it("ドメインの判定に失敗した場合はエラーを伝える", () => {
      const failure = new Error("DOMAIN_FAILED");
      expect(() => createTaskListView(
        [task("open", "other.test", false, null)],
        { completion: "all", domain: null },
        () => { throw failure; },
      )).toThrow(failure);
    });
  });

  describe("TS-002 タスク一覧の並び順", () => {
    it("期限、登録日時、IDの順に並べ、期限のないタスクを最後に置く", () => {
      const make = (id: string, dueDate: string | null, createdAt: string): TaskRecord => ({
        id,
        url: "https://example.com/",
        hostname: "example.com",
        name: id,
        dueDate,
        detail: "",
        completed: false,
        createdAt,
        reminderSuppressedUntil: null,
        revision: 1,
      });
      const tasks = [
        make("E", null, "2026-11-02T00:00:00.000Z"),
        make("C", "2026-11-25", "2026-11-01T00:00:00.000Z"),
        make("B", "2026-11-24", "2026-11-02T00:00:00.000Z"),
        make("D", null, "2026-11-01T00:00:00.000Z"),
        make("A0", "2026-11-24", "2026-11-01T00:00:00.000Z"),
        make("A", "2026-11-24", "2026-11-01T00:00:00.000Z"),
      ];
      expect(sortTasks(tasks).map((task) => task.id)).toEqual(["A", "A0", "B", "C", "D", "E"]);
      expect(tasks.map((task) => task.id)).toEqual(["E", "C", "B", "D", "A0", "A"]);
    });
  });
});
