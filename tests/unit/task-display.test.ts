// @trace TS-002
import { describe, expect, it } from "vitest";
import { isTaskOverdue, sortTasks } from "../../src/shared/task-display";
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
