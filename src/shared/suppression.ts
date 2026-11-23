// @trace DD-reminder-001
import { isUtcInstant } from "./utc-instant";

export function isSuppressionActive(suppressedUntil: string | null, now: Date): boolean {
  const timestamp = now.getTime();
  if (Number.isNaN(timestamp)) {
    throw new RangeError("現在日時が不正です。");
  }
  if (suppressedUntil === null) {
    return false;
  }

  if (!isUtcInstant(suppressedUntil)) {
    throw new RangeError("停止終了日時が不正です。");
  }
  return timestamp < new Date(suppressedUntil).getTime();
}
