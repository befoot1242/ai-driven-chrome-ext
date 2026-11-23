// @trace DD-task-002
import { sameDomainKey, type DomainKey } from "./domain-types";
import type { TaskRecord } from "./task-types";

export interface TaskListFilter {
  completion: "all" | "open" | "completed";
  domain: DomainKey | null;
}

export interface DomainOption {
  key: DomainKey;
  label: string;
  missing: boolean;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function createTaskListView(
  tasks: readonly TaskRecord[],
  filter: TaskListFilter,
  getDomainKeyFromHostname: (hostname: string) => DomainKey,
): {
  tasks: TaskRecord[];
  domains: DomainOption[];
  emptyState: "no-tasks" | "no-matches" | null;
} {
  const resolved = tasks.map((task) => ({
    task,
    domain: getDomainKeyFromHostname(task.hostname),
  }));
  const keys: DomainKey[] = [];
  for (const { domain } of resolved) {
    if (!keys.some((key) => sameDomainKey(key, domain))) keys.push(domain);
  }
  const selectedDomain = filter.domain;
  if (selectedDomain && !keys.some((key) => sameDomainKey(key, selectedDomain))) {
    keys.push(selectedDomain);
  }
  keys.sort((left, right) =>
    compareStrings(left.value, right.value) || compareStrings(left.kind, right.kind),
  );
  const domains = keys.map((key) => {
    const ambiguous = keys.some((other) => other.value === key.value && other.kind !== key.kind);
    const missing = !resolved.some(({ domain }) => sameDomainKey(key, domain));
    const kind = key.kind === "domain" ? "ドメイン" : "ホスト";
    return {
      key,
      label: `${key.value}${ambiguous ? `（${kind}）` : ""}${missing ? "（対象なし）" : ""}`,
      missing,
    };
  });
  const matching = resolved
    .filter(({ task, domain }) =>
      (filter.completion === "all" || task.completed === (filter.completion === "completed")) &&
      (selectedDomain === null || sameDomainKey(domain, selectedDomain)),
    )
    .map(({ task }) => task);
  return {
    tasks: sortTasks(matching),
    domains,
    emptyState: tasks.length === 0 ? "no-tasks" : matching.length === 0 ? "no-matches" : null,
  };
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
