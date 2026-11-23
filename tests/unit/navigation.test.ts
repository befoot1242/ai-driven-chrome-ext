// @trace TS-003
import { describe, expect, it } from "vitest";
import { getNavigationDecision } from "../../src/shared/navigation";

describe("TS-003 リマインド対象の遷移", () => {
  it("再読み込みはURLが同じでも再判定する", () => {
    expect(getNavigationDecision("completed", "https://example.com/", "https://example.com/")).toBe(
      "evaluate",
    );
  });

  it.each(["history", "fragment"] as const)("%sでURLが変わった場合だけ再判定する", (kind) => {
    expect(getNavigationDecision(kind, "https://example.com/a", "https://example.com/b")).toBe(
      "evaluate",
    );
    expect(getNavigationDecision(kind, "https://example.com/a", "https://example.com/a")).toBe(
      "ignore",
    );
  });

  it("直前のURLが不明な場合は遷移の有無を推測しない", () => {
    expect(getNavigationDecision("history", null, "https://example.com/a")).toBe("unknown");
  });
});
