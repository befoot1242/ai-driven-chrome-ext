// @trace TS-004
import { describe, expect, it } from "vitest";
import { isPopupSender, rejectUnavailableRequest } from "../../src/background/message-router";

describe("TS-004 不正な通信要求", () => {
  it.each([
    ["未対応の版", { version: 2, requestId: "test", kind: "TASK_QUERY", payload: null }],
    ["不正な種類", { version: 1, requestId: "test", kind: "UNKNOWN", payload: null }],
    ["未指定の内容", { version: 1, requestId: "test", kind: "TASK_QUERY" }],
  ])("%sを拒否する", (_label, request) => {
    expect(rejectUnavailableRequest(request)).toEqual({
      requestId: "test",
      ok: false,
      code: "INVALID_REQUEST",
    });
  });

  it("処理の未実装を成功として返さない", () => {
    expect(
      rejectUnavailableRequest({ version: 1, requestId: "test", kind: "TASK_QUERY", payload: null }),
    ).toEqual({ requestId: "test", ok: false, code: "OPERATION_UNAVAILABLE" });
  });

  it("一覧要求は拡張機能の popup の ID・オリジン・パスを照合する", () => {
    const sender: chrome.runtime.MessageSender = {
      id: "extension-id",
      origin: "chrome-extension://extension-id",
      url: "chrome-extension://extension-id/popup/index.html?view=all",
    };
    const allowed = (value: chrome.runtime.MessageSender) =>
      isPopupSender(value, "extension-id", "chrome-extension://extension-id");
    expect(allowed(sender)).toBe(true);
    expect(allowed({ ...sender, id: "other-id" })).toBe(false);
    expect(allowed({ ...sender, origin: undefined })).toBe(false);
    expect(allowed({ ...sender, url: "chrome-extension://extension-id/options/index.html" })).toBe(false);
    expect(allowed({ ...sender, url: "https://example.com/popup/index.html" })).toBe(false);
  });
});
