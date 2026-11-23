// @trace TS-001
import { describe, expect, it } from "vitest";
import { getCaptureWaitMs } from "../../src/shared/capture-rate";

describe("TS-001 撮影回数の制限", () => {
  it("直近1秒の呼び出しが2回に達した場合、境界まで待機する", () => {
    expect(getCaptureWaitMs([], 0)).toBe(0);
    expect(getCaptureWaitMs([0], 0)).toBe(0);
    expect(getCaptureWaitMs([0, 0], 999)).toBe(1);
    expect(getCaptureWaitMs([0, 0], 1_000)).toBe(0);
    expect(getCaptureWaitMs([0, 0, 1_000], 1_000)).toBe(0);
    expect(getCaptureWaitMs([0, 0, 1_000, 1_000], 1_000)).toBe(1_000);
  });

  it("直近1秒にすでに2回を超える履歴がある場合も安全に待機する", () => {
    expect(getCaptureWaitMs([0, 100, 200], 500)).toBe(600);
    expect(getCaptureWaitMs([0, 100, 200], 1_100)).toBe(0);
  });

  it("未来の履歴、順序の不整合、不正な時刻は撮影可能と判定しない", () => {
    expect(() => getCaptureWaitMs([101], 100)).toThrow(RangeError);
    expect(() => getCaptureWaitMs([50, 49], 100)).toThrow(RangeError);
    expect(() => getCaptureWaitMs([Number.NaN], 100)).toThrow(RangeError);
    expect(() => getCaptureWaitMs([], Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
