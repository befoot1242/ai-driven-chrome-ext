// @trace DD-task-002 DD-communication-001
import { createApp, h, nextTick, onMounted, ref } from "vue";
import { sendRuntimeMessage } from "../shared/chrome/runtime-message";
import "./popup.css";

type LoadState = "loading" | "unavailable" | "error";

function isErrorResponse(value: unknown, requestId: string): value is { code: string } {
  return typeof value === "object" && value !== null &&
    "requestId" in value && value.requestId === requestId &&
    "ok" in value && value.ok === false &&
    "code" in value && typeof value.code === "string";
}

createApp({
  setup() {
    const state = ref<LoadState>("loading");
    const errorElement = ref<HTMLElement | null>(null);

    async function loadTasks(): Promise<void> {
      state.value = "loading";
      const requestId = crypto.randomUUID();
      try {
        const response = await sendRuntimeMessage({
          version: 1,
          requestId,
          kind: "TASK_QUERY",
          payload: null,
        });
        if (isErrorResponse(response, requestId) && response.code === "OPERATION_UNAVAILABLE") {
          state.value = "unavailable";
        } else {
          console.error("TASK_QUERY_FAILED");
          state.value = "error";
        }
      } catch {
        console.error("TASK_QUERY_COMMUNICATION_FAILED");
        state.value = "error";
      }
      await nextTick();
      errorElement.value?.focus();
    }

    onMounted(loadTasks);

    return () => h("section", { class: "popup" }, [
      h("h1", "タスク一覧"),
      state.value === "loading"
        ? h("p", { "data-testid": "task-loading", role: "status" }, "読み込み中")
        : h("div", [
          h("p", {
            ref: errorElement,
            class: "error",
            role: "alert",
            tabindex: -1,
            "data-testid": "task-error",
          }, state.value === "unavailable"
            ? "タスク一覧は現在利用できません。"
            : "タスク一覧を読み込めませんでした。再試行してください。"),
          h("button", {
            type: "button",
            "data-testid": "task-retry",
            onClick: loadTasks,
          }, "再試行"),
        ]),
    ]);
  },
}).mount("#app");
