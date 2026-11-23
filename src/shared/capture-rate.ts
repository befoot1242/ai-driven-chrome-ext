// @trace DD-capture-001

const CAPTURE_WINDOW_MS = 1_000;
const MAX_CAPTURES_PER_WINDOW = 2;

export function getCaptureWaitMs(previousAttempts: readonly number[], now: number): number {
  if (!Number.isSafeInteger(now)) throw new RangeError("現在時刻が不正です。");

  let previous: number | undefined;
  const recent: number[] = [];
  for (const attempt of previousAttempts) {
    if (!Number.isSafeInteger(attempt) || attempt > now || (previous !== undefined && attempt < previous)) {
      throw new RangeError("撮影履歴が不正です。");
    }
    if (now - attempt < CAPTURE_WINDOW_MS) recent.push(attempt);
    previous = attempt;
  }
  if (recent.length < MAX_CAPTURES_PER_WINDOW) return 0;
  const oldestBlockingAttempt = recent[recent.length - MAX_CAPTURES_PER_WINDOW];
  if (oldestBlockingAttempt === undefined) throw new RangeError("撮影履歴を判定できません。");
  return CAPTURE_WINDOW_MS - (now - oldestBlockingAttempt);
}
