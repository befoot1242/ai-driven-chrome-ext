// @trace DD-reminder-001
import { getDomainKeyFromHostname } from "./domain";
import { sameDomainKey, type DomainKey } from "./domain-types";
import { isSuppressionActive } from "./suppression";

export interface ReminderCandidate {
  id: string;
  hostname: string;
  completed: boolean;
  suppressedUntil: string | null;
}

export interface DomainSuppression {
  hostname: string;
  suppressedUntil: string;
}

export function selectReminderTasks(
  pageDomain: DomainKey,
  tasks: readonly ReminderCandidate[],
  domainSuppressions: readonly DomainSuppression[],
  now: Date,
): ReminderCandidate[] {
  if (Number.isNaN(now.getTime())) throw new RangeError("現在日時が不正です。");
  let domainStopped = false;
  for (const suppression of domainSuppressions) {
    if (sameDomainKey(getDomainKeyFromHostname(suppression.hostname), pageDomain)) {
      domainStopped = isSuppressionActive(suppression.suppressedUntil, now) || domainStopped;
    }
  }
  if (domainStopped) return [];
  return tasks.filter(
    (task) =>
      sameDomainKey(getDomainKeyFromHostname(task.hostname), pageDomain) &&
      !task.completed &&
      !isSuppressionActive(task.suppressedUntil, now),
  );
}
