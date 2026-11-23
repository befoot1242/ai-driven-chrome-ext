// @trace DD-task-001 DD-task-002 DD-capture-001

const MAX_IMAGE_COUNT = 10;
const MAX_IMAGE_BYTES = 5_000_000;

export type ImageValidationError = "IMAGE_COUNT_EXCEEDED" | "IMAGE_SIZE_EXCEEDED";

export function validateImageLimits(images: readonly Blob[]): ImageValidationError | null {
  if (images.length > MAX_IMAGE_COUNT) {
    return "IMAGE_COUNT_EXCEEDED";
  }

  if (images.some((image) => image.size > MAX_IMAGE_BYTES)) {
    return "IMAGE_SIZE_EXCEEDED";
  }

  return null;
}
