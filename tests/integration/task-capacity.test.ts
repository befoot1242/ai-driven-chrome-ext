// @trace TS-002
import { describe, expect, it } from "vitest";
import { calculateLogicalCapacity } from "../../src/background/task-capacity";
import type { ImageRecord, TaskRecord } from "../../src/shared/task-types";

describe("TS-002 保存データの論理容量", () => {
  it("UTF-8の文字列と画像のバイト数を合計する", () => {
    const task: TaskRecord = {
      id: "1",
      url: "https://example.com/",
      hostname: "example.com",
      name: "あ",
      dueDate: null,
      detail: "",
      completed: false,
      createdAt: "2026-11-23T00:00:00.000Z",
      reminderSuppressedUntil: null,
      revision: 1,
    };
    const image: ImageRecord = { id: "i", taskId: "1", position: 0, data: new Blob(["abc"]) };
    expect(calculateLogicalCapacity([task], [image])).toBe(244);
  });
});
