// @trace DD-task-002 DD-communication-001
import { createApp, h, onMounted, ref } from "vue";
import { TaskEditor } from "../popup/editor";
import {
  operationErrorMessage,
  PopupOperationError,
  queryActiveDraft,
  readOperationResult,
  request,
  type ActiveDraftView,
} from "../popup/popup-api";
import "../popup/popup.css";
import "./registration.css";

createApp({
  setup() {
    const active = ref<ActiveDraftView | null>(null);
    const loading = ref(true);
    const error = ref("");

    onMounted(async () => {
      const params = new URLSearchParams(location.search);
      const code = params.get("error");
      if (code) {
        error.value = code === "INVALID_TARGET"
          ? "対象のHTTPまたはHTTPSページを確認できませんでした。"
          : operationErrorMessage(new PopupOperationError(code));
        loading.value = false;
        return;
      }
      const id = params.get("operation");
      const generationText = params.get("generation");
      const generation = generationText === null ? NaN : Number(generationText);
      if (!id || !Number.isSafeInteger(generation) || generation < 1) {
        error.value = "登録操作を確認できませんでした。";
        loading.value = false;
        return;
      }
      try {
        const current = await queryActiveDraft();
        if (
          !current || current.draft.kind !== "registration" ||
          current.operation.id !== id || current.operation.generation !== generation
        ) throw new PopupOperationError("STALE_OPERATION");
        const resumed = readOperationResult(await request("RESUME_DRAFT", current.operation));
        const latest = await queryActiveDraft();
        if (
          !latest || latest.draft.kind !== "registration" ||
          latest.operation.id !== resumed.id || latest.operation.generation !== resumed.generation
        ) throw new PopupOperationError("STALE_OPERATION");
        active.value = latest;
      } catch (cause) {
        console.error("REGISTRATION_LOAD_FAILED");
        error.value = operationErrorMessage(cause);
      } finally {
        loading.value = false;
      }
    });

    return () => active.value
      ? h(TaskEditor, { active: active.value, onFinished: () => window.close() })
      : h("section", { class: "popup" }, [
        h("h1", "タスク登録"),
        loading.value ? h("p", { role: "status" }, "読み込み中")
          : h("div", [
            h("p", { class: "error", role: "alert", "data-testid": "registration-error" }, error.value),
            h("a", { href: "../popup/index.html" }, "タスク一覧を開く"),
          ]),
      ]);
  },
}).mount("#app");
