// @trace TS-003
import { describe, expect, it } from "vitest";
import { isSuppressionActive } from "../../src/shared/suppression";

describe("TS-003 停止終了日時の判定", () => {
  const end = "2026-11-23T12:00:00.000Z";

  it.each([
    ["1ミリ秒前", "2026-11-23T11:59:59.999Z", true],
    ["同時", "2026-11-23T12:00:00.000Z", false],
    ["1ミリ秒後", "2026-11-23T12:00:00.001Z", false],
  ])("%sを判定する", (_label, time, expected) => {
    expect(isSuppressionActive(end, new Date(time))).toBe(expected);
  });
});
