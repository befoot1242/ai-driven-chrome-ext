// @trace TS-004
import { describe, expect, it } from "vitest";
import { rejectUnavailableRequest } from "../../src/background/message-router";

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
});
