// @trace DD-task-001
import type { ImageRecord, TaskRecord } from "../shared/task-types";

export function calculateLogicalCapacity(tasks: readonly TaskRecord[], images: readonly ImageRecord[]): number {
  const encoder = new TextEncoder();
  let bytes = 0;
  for (const task of tasks) {
    bytes += encoder.encode(
      JSON.stringify({
        id: task.id,
        url: task.url,
        hostname: task.hostname,
        name: task.name,
        dueDate: task.dueDate,
        detail: task.detail,
        completed: task.completed,
        createdAt: task.createdAt,
        reminderSuppressedUntil: task.reminderSuppressedUntil,
        revision: task.revision,
      }),
    ).byteLength;
  }
  for (const image of images) {
    bytes += encoder.encode(
      JSON.stringify({ id: image.id, taskId: image.taskId, position: image.position }),
    ).byteLength;
    bytes += image.data.size;
  }
  if (!Number.isSafeInteger(bytes)) throw new RangeError("論理容量を正確に計算できません。");
  return bytes;
}
