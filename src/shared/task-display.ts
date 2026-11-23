// @trace DD-task-002
import type { TaskRecord } from "./task-types";

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function sortTasks(tasks: readonly TaskRecord[]): TaskRecord[] {
  return [...tasks].sort((left, right) => {
    if (left.dueDate === null && right.dueDate !== null) return 1;
    if (left.dueDate !== null && right.dueDate === null) return -1;
    if (left.dueDate !== null && right.dueDate !== null) {
      const byDueDate = compareStrings(left.dueDate, right.dueDate);
      if (byDueDate !== 0) return byDueDate;
    }
    return compareStrings(left.createdAt, right.createdAt) || compareStrings(left.id, right.id);
  });
}

export function isTaskOverdue(
  task: { dueDate: string | null; completed: boolean },
  now: Date,
): boolean {
  if (Number.isNaN(now.getTime())) {
    throw new RangeError("現在日時が不正です。");
  }
  if (task.completed || task.dueDate === null) {
    return false;
  }

  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return task.dueDate < `${year}-${month}-${day}`;
}
