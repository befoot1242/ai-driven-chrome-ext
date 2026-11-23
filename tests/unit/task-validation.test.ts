// @trace TS-001 TS-002
import { describe, expect, it } from "vitest";
import { validateTaskForm, type TaskFormFields } from "../../src/shared/task-validation";

describe("TS-001 TS-002 登録・編集の入力検証", () => {
  const valid: TaskFormFields = {
    name: "タスク",
    url: "https://EXAMPLE.com/path",
    dueDate: null,
    detail: "詳細",
  };

  it("期限なしの入力を受け付け、URLから正規化したホストを求める", () => {
    expect(validateTaskForm(valid)).toEqual({ errors: {}, hostname: "example.com" });
    expect(valid.url).toBe("https://EXAMPLE.com/path");
  });

  it("必須名、URL、期限の誤りをそれぞれ通知し、入力を変更しない", () => {
    const fields = { ...valid, name: " ", url: "invalid", dueDate: "2026-02-29" };
    const result = validateTaskForm(fields);
    expect(result.errors).toEqual({
      name: expect.any(String),
      url: expect.any(String),
      dueDate: expect.any(String),
    });
    expect(result.hostname).toBeNull();
    expect(fields).toEqual({ ...valid, name: " ", url: "invalid", dueDate: "2026-02-29" });
  });

  it.each(["file:///tmp/test", "ftp://example.com/"])("HTTP以外のURL %s を拒否する", (url) => {
    expect(validateTaskForm({ ...valid, url })).toMatchObject({
      errors: { url: expect.any(String) },
      hostname: null,
    });
  });

  it("実在するうるう日を受け付け、不正な日付を拒否する", () => {
    expect(validateTaskForm({ ...valid, dueDate: "2024-02-29" }).errors).toEqual({});
    for (const dueDate of ["2024-02-30", "2024-13-01", "2024-01-00", "2024-2-01", ""]) {
      expect(validateTaskForm({ ...valid, dueDate }).errors.dueDate).toBeTruthy();
    }
  });
});
