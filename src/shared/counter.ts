// @trace DD-counter-001
// サンプル: chrome.* に依存しない純粋ロジック（単体テストの対象）。

export const MAX_COUNT = 999;

export function increment(current: number): number {
  if (!Number.isInteger(current) || current < 0) {
    throw new RangeError(`invalid count: ${current}`);
  }
  return Math.min(current + 1, MAX_COUNT);
}
