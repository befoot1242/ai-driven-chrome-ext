// @trace TS-003
import { describe, expect, it } from "vitest";
import type { DomainKey } from "../../src/shared/domain-types";
import {
  selectReminderTasks,
  type ReminderCandidate,
} from "../../src/shared/reminder-selection";

describe("TS-003 リマインド対象の選別", () => {
  const domain: DomainKey = { kind: "domain", value: "example.com" };
  const now = new Date("2026-11-23T12:00:00.000Z");
  const candidate = (id: string, overrides: Partial<ReminderCandidate> = {}): ReminderCandidate => ({
    id,
    hostname: "www.example.com",
    completed: false,
    suppressedUntil: null,
    ...overrides,
  });

  it("対象ドメインの停止されていない未完了タスクだけを選ぶ", () => {
    const tasks = [
      candidate("対象"),
      candidate("完了", { completed: true }),
      candidate("停止中", { suppressedUntil: "2026-11-23T12:00:00.001Z" }),
      candidate("停止終了", { suppressedUntil: "2026-11-23T12:00:00.000Z" }),
      candidate("別ドメイン", { hostname: "other.test" }),
    ];
    expect(selectReminderTasks(domain, tasks, [], now).map((task) => task.id)).toEqual([
      "対象",
      "停止終了",
    ]);
  });

  it("同じ対象に複数の停止設定があれば最も遅い終了日時まで停止する", () => {
    const tasks = [candidate("対象")];
    const settings = [
      { hostname: "a.example.com", suppressedUntil: "2026-11-23T12:00:00.000Z" },
      { hostname: "b.example.com", suppressedUntil: "2026-11-23T12:00:00.001Z" },
    ];
    expect(selectReminderTasks(domain, tasks, settings, now)).toEqual([]);
    expect(
      selectReminderTasks(domain, tasks, settings, new Date("2026-11-23T12:00:00.001Z")),
    ).toEqual(tasks);
  });

  it("値が同じでもドメインとホストの種別が違えば選ばない", () => {
    expect(
      selectReminderTasks({ kind: "host", value: "example.com" }, [candidate("対象")], [], now),
    ).toEqual([]);
  });
});
