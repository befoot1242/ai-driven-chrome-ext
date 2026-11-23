// @trace DD-task-002 DD-task-001 DD-communication-001
import { defineComponent, h, nextTick, onMounted, onUnmounted, ref, type PropType } from "vue";
import { getActiveDraft } from "../background/task-repository";
import { getDomainKeyFromHostname } from "../shared/domain";
import type { DraftFields } from "../shared/task-types";
import { validateTaskForm, type TaskFormErrors } from "../shared/task-validation";
import { operationErrorMessage, PopupOperationError, request, type ActiveDraftView } from "./popup-api";

interface ImageView {
  id: string;
  url: string;
}

export const TaskEditor = defineComponent({
  props: {
    active: { type: Object as PropType<ActiveDraftView>, required: true },
  },
  emits: ["finished"],
  setup(props, { emit }) {
    const fields = ref<DraftFields>({ ...props.active.draft.fields });
    const images = ref<ImageView[]>([]);
    const loading = ref(true);
    const ready = ref(false);
    const working = ref(false);
    const saveStatus = ref<"saved" | "saving" | "failed">("saved");
    const error = ref("");
    const errors = ref<TaskFormErrors>({});
    const nameElement = ref<HTMLInputElement | null>(null);
    const urlElement = ref<HTMLInputElement | null>(null);
    const dateElement = ref<HTMLInputElement | null>(null);
    const errorElement = ref<HTMLElement | null>(null);
    const objectUrls: string[] = [];
    let sequence = 0;
    let lastSaved = 0;
    let saveChain = Promise.resolve();
    let disposed = false;

    onMounted(async () => {
      try {
        const stored = await getActiveDraft();
        if (disposed) return;
        if (
          !stored || stored.operation.id !== props.active.operation.id ||
          stored.operation.generation !== props.active.operation.generation ||
          stored.draft.id !== props.active.draft.id ||
          stored.draft.images.length !== props.active.draft.imageIds.length ||
          stored.draft.images.some((image, index) => image.id !== props.active.draft.imageIds[index])
        ) {
          throw new PopupOperationError("STALE_OPERATION");
        }
        images.value = stored.draft.images.map((image) => {
          const url = URL.createObjectURL(image.data);
          objectUrls.push(url);
          return { id: image.id, url };
        });
        ready.value = true;
        loading.value = false;
        await nextTick();
        nameElement.value?.focus();
      } catch (cause) {
        if (disposed) return;
        console.error("DRAFT_LOAD_FAILED");
        error.value = operationErrorMessage(cause);
        loading.value = false;
      }
    });

    onUnmounted(() => {
      disposed = true;
      for (const url of objectUrls) URL.revokeObjectURL(url);
    });

    function scheduleSave(): void {
      const current = ++sequence;
      const snapshot = { ...fields.value };
      const imageIds = images.value.map((image) => image.id);
      saveStatus.value = "saving";
      saveChain = saveChain.then(async () => {
        try {
          await request("SAVE_DRAFT", { operation: props.active.operation, fields: snapshot, imageIds });
          if (current === sequence) {
            lastSaved = current;
            saveStatus.value = "saved";
            error.value = "";
          }
        } catch (cause) {
          console.error("DRAFT_SAVE_FAILED");
          if (current === sequence) {
            saveStatus.value = "failed";
            error.value = operationErrorMessage(cause);
          }
        }
      });
    }

    function changeField(key: keyof DraftFields, event: Event): void {
      if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) return;
      fields.value = { ...fields.value, [key]: event.target.value };
      errors.value = {};
      scheduleSave();
    }

    function removeImage(id: string): void {
      images.value = images.value.filter((image) => image.id !== id);
      scheduleSave();
    }

    async function save(): Promise<void> {
      if (working.value || !ready.value) return;
      working.value = true;
      await saveChain;
      if (sequence !== lastSaved || saveStatus.value === "failed") {
        if (!error.value) error.value = "途中入力を保存できませんでした。入力を保持しています。";
        working.value = false;
        return;
      }
      const validation = validateTaskForm({
        ...fields.value,
        dueDate: fields.value.dueDate === "" ? null : fields.value.dueDate,
      });
      errors.value = validation.errors;
      if (Object.keys(validation.errors).length > 0) {
        working.value = false;
        await nextTick();
        if (validation.errors.name) nameElement.value?.focus();
        else if (validation.errors.url) urlElement.value?.focus();
        else dateElement.value?.focus();
        return;
      }
      try {
        await request("COMMIT_DRAFT", props.active.operation);
        emit("finished");
      } catch (cause) {
        console.error("DRAFT_COMMIT_FAILED");
        error.value = operationErrorMessage(cause);
        await nextTick();
        errorElement.value?.focus();
      } finally {
        working.value = false;
      }
    }

    async function cancel(): Promise<void> {
      if (working.value) return;
      working.value = true;
      await saveChain;
      try {
        await request("DISCARD_DRAFT", props.active.operation);
        emit("finished");
      } catch (cause) {
        console.error("DRAFT_DISCARD_FAILED");
        error.value = operationErrorMessage(cause);
        await nextTick();
        errorElement.value?.focus();
      } finally {
        working.value = false;
      }
    }

    return () => {
      const validation = validateTaskForm({
        ...fields.value,
        dueDate: fields.value.dueDate === "" ? null : fields.value.dueDate,
      });
      const hostname = validation.hostname;
      return h("section", { class: "popup" }, [
        h("h1", props.active.draft.kind === "edit" ? "タスク編集" : "タスク登録"),
        error.value ? h("p", {
          ref: errorElement, class: "error", role: "alert", tabindex: -1, "data-testid": "editor-error",
        }, error.value) : null,
        loading.value ? h("p", { role: "status" }, "読み込み中")
          : !ready.value ? h("button", { type: "button", onClick: () => emit("finished") }, "一覧へ戻る")
            : h("div", [
          h("p", { role: "status", "data-testid": "draft-status" },
            saveStatus.value === "saving" ? "保存中" : saveStatus.value === "saved" ? "保存済み" : "保存失敗"),
          h("label", [
            "タスク名（必須）",
            h("input", {
              ref: nameElement, value: fields.value.name, disabled: working.value,
              "data-testid": "edit-name", onInput: (event: Event) => changeField("name", event),
            }),
            errors.value.name ? h("span", { class: "error" }, errors.value.name) : null,
          ]),
          h("label", [
            "URL",
            h("input", {
              ref: urlElement, value: fields.value.url,
              disabled: working.value || props.active.draft.kind === "registration",
              "data-testid": "edit-url", onInput: (event: Event) => changeField("url", event),
            }),
            errors.value.url ? h("span", { class: "error" }, errors.value.url) : null,
          ]),
          h("p", { "data-testid": "edit-domain" },
            hostname ? `対象ドメイン: ${getDomainKeyFromHostname(hostname).value}` : "対象ドメイン: URLを確認してください。"),
          h("label", [
            "期限（YYYY-MM-DD）",
            h("input", {
              ref: dateElement, value: fields.value.dueDate, disabled: working.value,
              "data-testid": "edit-due-date", onInput: (event: Event) => changeField("dueDate", event),
            }),
            errors.value.dueDate ? h("span", { class: "error" }, errors.value.dueDate) : null,
          ]),
          h("label", [
            "詳細",
            h("textarea", {
              value: fields.value.detail, disabled: working.value,
              "data-testid": "edit-detail", onInput: (event: Event) => changeField("detail", event),
            }),
          ]),
          h("p", `画像 ${images.value.length} / 10`),
          h("ul", images.value.map((image, index) => h("li", { key: image.id }, [
            h("a", { href: image.url, target: "_blank", rel: "noopener" }, [
              h("img", { src: image.url, alt: `画像${index + 1}`, class: "thumbnail" }),
            ]),
            h("button", {
              type: "button", disabled: working.value, "data-testid": `remove-image-${index}`,
              onClick: () => removeImage(image.id),
            }, "画像を削除"),
          ]))),
          h("p", "撮影と画像の差し替えは現在利用できません。"),
          h("button", { type: "button", disabled: working.value, "data-testid": "edit-save", onClick: save }, "保存"),
          h("button", { type: "button", disabled: working.value, "data-testid": "edit-cancel", onClick: cancel }, "取消"),
        ]),
      ]);
    };
  },
});
