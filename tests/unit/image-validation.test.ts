// @trace TS-001
import { describe, expect, it } from "vitest";
import { validateImageLimits } from "../../src/shared/image-validation";

describe("TS-001 画像の枚数と容量", () => {
  it("画像が0枚の場合は受け付ける", () => {
    expect(validateImageLimits([])).toBeNull();
  });

  it("画像が10枚の場合は受け付ける", () => {
    expect(validateImageLimits(Array.from({ length: 10 }, () => new Blob()))).toBeNull();
  });

  it("画像が5,000,000バイトの場合は受け付ける", () => {
    expect(validateImageLimits([new Blob([new Uint8Array(5_000_000)])])).toBeNull();
  });

  it("画像が11枚ある場合は拒否する", () => {
    expect(validateImageLimits(Array.from({ length: 11 }, () => new Blob()))).toBe(
      "IMAGE_COUNT_EXCEEDED",
    );
  });

  it("1枚でも上限より大きい場合は拒否する", () => {
    expect(validateImageLimits([new Blob(), new Blob([new Uint8Array(5_000_001)])])).toBe(
      "IMAGE_SIZE_EXCEEDED",
    );
  });
});
