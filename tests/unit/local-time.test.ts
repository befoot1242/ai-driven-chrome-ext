// @trace TS-003
import { Temporal as TemporalPolyfill } from "@js-temporal/polyfill";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLocalTimeCandidates } from "../../src/shared/local-time";

describe("TS-003 停止終了日時の変換", () => {
  beforeEach(() => {
    vi.stubGlobal("Temporal", TemporalPolyfill);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("存在しない現地日時には候補がない", () => {
    expect(getLocalTimeCandidates("2024-03-10", "02:05", "America/New_York")).toEqual([]);
  });

  it("重複する現地日時にはオフセットの異なる2候補がある", () => {
    expect(getLocalTimeCandidates("2024-11-03", "01:05", "America/New_York")).toEqual([
      { instant: "2024-11-03T05:05:00.000Z", offset: "-04:00" },
      { instant: "2024-11-03T06:05:00.000Z", offset: "-05:00" },
    ]);
  });

  it("日時変換機能がない場合は推測せずエラーにする", () => {
    vi.stubGlobal("Temporal", undefined);
    expect(() => getLocalTimeCandidates("2024-01-02", "01:05", "America/New_York")).toThrow(
      "日時の変換機能を利用できません。",
    );
  });
});
