// @trace DD-reminder-001 DD-task-002

export type DomainKey =
  | { kind: "domain"; value: string }
  | { kind: "host"; value: string };

export function sameDomainKey(left: DomainKey, right: DomainKey): boolean {
  return left.kind === right.kind && left.value === right.value;
}
