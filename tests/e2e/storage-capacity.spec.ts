// @trace TS-002
import { resolve } from "node:path";
import { build } from "vite";
import { expect, test } from "./extension-fixture";

test.describe("TS-002 保存容量の補助確認", () => {
  test("拡張機能オリジンの IndexedDB で論理容量100MBを保存・再読込する", async ({
    extensionContext,
    extensionId,
  }) => {
    test.setTimeout(120_000);
    const output = await build({
      configFile: false,
      logLevel: "silent",
      build: {
        write: false,
        rollupOptions: {
          input: resolve("src/background/task-repository.ts"),
          preserveEntrySignatures: "strict",
          output: { format: "iife", name: "__testRepository" },
        },
      },
    });
    if (Array.isArray(output) || !("output" in output)) {
      throw new Error("保存処理のテスト用ビルドを取得できません。");
    }
    const bundle = output.output.find((item) => item.type === "chunk");
    if (!bundle || bundle.type !== "chunk") {
      throw new Error("保存処理のテスト用コードを取得できません。");
    }

    const page = await extensionContext.newPage();
    await page.goto(`chrome-extension://${extensionId}/options/index.html`);
    const debuggerSession = await extensionContext.newCDPSession(page);
    try {
      const evaluated = await debuggerSession.send("Runtime.evaluate", {
        expression: bundle.code,
        allowUnsafeEvalBlockedByCSP: true,
      });
      if (evaluated.exceptionDetails) {
        throw new Error("保存処理のテスト用コードを実行できません。");
      }
    } finally {
      await debuggerSession.detach();
    }

    const result = await page.evaluate(async () => {
      const repository = (
        globalThis as typeof globalThis & {
          __testRepository: typeof import("../../src/background/task-repository");
        }
      ).__testRepository;
      const encoder = new TextEncoder();
      const tasks: import("../../src/shared/task-types").TaskRecord[] = [];
      const images: import("../../src/shared/task-types").ImageRecord[] = [];

      for (let taskIndex = 0; taskIndex < 2; taskIndex++) {
        const id = `task-${taskIndex}`;
        tasks.push({
          id,
          url: "https://example.com/",
          hostname: "example.com",
          name: `タスク${taskIndex}`,
          dueDate: null,
          detail: "",
          completed: false,
          createdAt: "2026-11-23T00:00:00.000Z",
          reminderSuppressedUntil: null,
          revision: 1,
        });
        for (let position = 0; position < 10; position++) {
          const length = taskIndex === 1 && position === 9 ? 4_990_000 : 5_000_000;
          const bytes = new Uint8Array(length).fill(taskIndex * 10 + position);
          images.push({ id: `image-${taskIndex}-${position}`, taskId: id, position, data: new Blob([bytes]) });
        }
      }

      function capacity(
        taskRecords: typeof tasks,
        imageRecords: typeof images,
      ): number {
        return taskRecords.reduce((sum, task) => sum + encoder.encode(JSON.stringify(task)).length, 0)
          + imageRecords.reduce(
            (sum, image) =>
              sum + encoder.encode(JSON.stringify({
                id: image.id,
                taskId: image.taskId,
                position: image.position,
              })).length + image.data.size,
            0,
          );
      }

      const firstTask = tasks[0];
      if (!firstTask) throw new Error("検証用タスクがありません。");
      const padding = 100_000_000 - capacity(tasks, images);
      if (padding < 0) throw new Error("検証データが指定容量を超過しています。");
      firstTask.detail = "x".repeat(padding);

      for (const task of tasks) {
        await repository.saveTask(
          { ...task, revision: 0 },
          images.filter((image) => image.taskId === task.id),
          null,
        );
      }
      const savedTasks = await repository.listTasks();
      const savedImages: typeof images = [];
      let contentsMatch = savedTasks.length === tasks.length;
      for (const expected of tasks) {
        const result = await repository.getTask(expected.id);
        if (!result || JSON.stringify(result.task) !== JSON.stringify(expected)) {
          contentsMatch = false;
          continue;
        }
        const expectedImages = images.filter((image) => image.taskId === expected.id);
        if (result.images.length !== expectedImages.length) contentsMatch = false;
        for (const [position, image] of result.images.entries()) {
          const expectedImage = expectedImages[position];
          if (!expectedImage || image.id !== expectedImage.id ||
            image.taskId !== expectedImage.taskId || image.position !== expectedImage.position ||
            image.data.size !== expectedImage.data.size) {
            contentsMatch = false;
            continue;
          }
          const actualBytes = new Uint8Array(await image.data.arrayBuffer());
          const expectedByte = Number(expected.id.slice(-1)) * 10 + position;
          if (actualBytes.some((byte) => byte !== expectedByte)) contentsMatch = false;
        }
        savedImages.push(...result.images);
      }
      return { bytes: capacity(savedTasks, savedImages), contentsMatch };
    });

    expect(result).toEqual({ bytes: 100_000_000, contentsMatch: true });
  });
});
