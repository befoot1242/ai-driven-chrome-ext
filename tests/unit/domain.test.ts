// @trace TS-003
import { describe, expect, it } from "vitest";
import { getDomainKey, getDomainKeyFromHostname } from "../../src/shared/domain";

describe("TS-003 対象ドメインの判定", () => {
  it("サブドメインを正規化して同じ対象にする", () => {
    expect(getDomainKey("https://WWW.Example.com/a")).toEqual(
      getDomainKey("https://shop.example.com/b"),
    );
    expect(getDomainKey("https://WWW.Example.com/a")).toEqual({
      kind: "domain",
      value: "example.com",
    });
  });

  it("co.jpと共有サービスの別利用者を区別する", () => {
    expect(getDomainKeyFromHostname("example.co.jp")).not.toEqual(
      getDomainKeyFromHostname("other.co.jp"),
    );
    expect(getDomainKeyFromHostname("user-a.github.io")).not.toEqual(
      getDomainKeyFromHostname("user-b.github.io"),
    );
  });

  it.each(["localhost", "127.0.0.1", "[::1]", "com"])(
    "%sは正規化されたホストとして扱う",
    (hostname) => {
      expect(getDomainKeyFromHostname(hostname)).toEqual({ kind: "host", value: hostname });
    },
  );

  it("HTTPとHTTPS以外のURLは拒否する", () => {
    expect(() => getDomainKey("file:///example.txt")).toThrow(RangeError);
  });
});
