// @trace DD-task-002 DD-communication-001
import { computed, createApp, h, nextTick, onMounted, ref } from "vue";
import { getDomainKeyFromHostname } from "../shared/domain";
import { sameDomainKey, type DomainKey } from "../shared/domain-types";
import { createTaskListView, isTaskOverdue, type TaskListFilter } from "../shared/task-display";
import type { OperationRef, TaskRecord } from "../shared/task-types";
import { TaskEditor } from "./editor";
import {
  operationErrorMessage,
  PopupOperationError,
  queryActiveDraft,
  queryDomainSuppressions,
  queryTasks,
  readOperationResult,
  request,
  type ActiveDraftView,
} from "./popup-api";
import { SuppressionEditor, type SuppressionTarget } from "./suppression";
import "./popup.css";

type Confirmation = { kind: "task"; task: TaskRecord } | { kind: "draft"; active: ActiveDraftView };

function domainValue(domain: DomainKey): string {
  return JSON.stringify([domain.kind, domain.value]);
}

createApp({
  setup() {
    const state = ref<"loading" | "ready" | "error">("loading");
    const tasks = ref<TaskRecord[]>([]);
    const active = ref<ActiveDraftView | null>(null);
    const editing = ref<ActiveDraftView | null>(null);
    const suppression = ref<SuppressionTarget | null>(null);
    const confirmation = ref<Confirmation | null>(null);
    const completion = ref<TaskListFilter["completion"]>("all");
    const domain = ref<DomainKey | null>(null);
    const message = ref("");
    const busy = ref(false);
    const errorElement = ref<HTMLElement | null>(null);
    const filterElement = ref<HTMLSelectElement | null>(null);
    const cancelElement = ref<HTMLButtonElement | null>(null);
    const confirmElement = ref<HTMLButtonElement | null>(null);
    const deleteButtons = new Map<string, HTMLButtonElement>();
    const list = computed(() => createTaskListView(
      tasks.value,
      { completion: completion.value, domain: domain.value },
      getDomainKeyFromHostname,
    ));

    async function loadTasks(): Promise<void> {
      state.value = "loading";
      message.value = "";
      try {
        const [loaded, current] = await Promise.all([queryTasks(), queryActiveDraft()]);
        for (const task of loaded) getDomainKeyFromHostname(task.hostname);
        tasks.value = loaded;
        active.value = current;
        state.value = "ready";
      } catch (error) {
        console.error("TASK_QUERY_FAILED");
        message.value = operationErrorMessage(error);
        state.value = "error";
      }
      await nextTick();
      if (state.value === "ready") filterElement.value?.focus();
      else errorElement.value?.focus();
    }

    async function showFailure(error: unknown): Promise<void> {
      console.error("TASK_OPERATION_FAILED");
      message.value = operationErrorMessage(error);
      if (error instanceof PopupOperationError && error.code === "OPERATION_ACTIVE") {
        try {
          active.value = await queryActiveDraft();
        } catch {
          console.error("DRAFT_QUERY_FAILED");
        }
      }
      await nextTick();
      errorElement.value?.focus();
    }

    function selectCompletion(event: Event): void {
      if (!(event.target instanceof HTMLSelectElement)) return;
      const value = event.target.value;
      if (value === "all" || value === "open" || value === "completed") completion.value = value;
    }

    function selectDomain(event: Event): void {
      if (!(event.target instanceof HTMLSelectElement)) return;
      const value = event.target.value;
      if (value === "") {
        domain.value = null;
      } else {
        const selected = list.value.domains.find((option) => domainValue(option.key) === value);
        if (selected) domain.value = selected.key;
      }
    }

    function blockedByActive(): boolean {
      if (!active.value) return false;
      message.value = "登録または編集が進行中です。完了するか破棄してください。";
      void nextTick(() => errorElement.value?.focus());
      return true;
    }

    async function openEditor(operation: OperationRef): Promise<void> {
      const current = await queryActiveDraft();
      if (
        !current || current.operation.id !== operation.id ||
        current.operation.generation !== operation.generation
      ) {
        throw new PopupOperationError("STALE_OPERATION");
      }
      active.value = current;
      editing.value = current;
    }

    async function startEdit(task: TaskRecord): Promise<void> {
      if (busy.value || blockedByActive()) return;
      busy.value = true;
      message.value = "";
      try {
        const operation = readOperationResult(await request("START_DRAFT", { id: task.id }));
        await openEditor(operation);
      } catch (error) {
        await showFailure(error);
      } finally {
        busy.value = false;
      }
    }

    async function resume(): Promise<void> {
      if (busy.value || !active.value) return;
      busy.value = true;
      message.value = "";
      try {
        const operation = readOperationResult(await request("RESUME_DRAFT", active.value.operation));
        await openEditor(operation);
      } catch (error) {
        await showFailure(error);
      } finally {
        busy.value = false;
      }
    }

    async function toggle(task: TaskRecord): Promise<void> {
      if (busy.value || blockedByActive()) return;
      busy.value = true;
      message.value = "";
      try {
        await request("TASK_SAVE", {
          id: task.id, expectedRevision: task.revision, completed: !task.completed,
        });
        await loadTasks();
      } catch (error) {
        await showFailure(error);
      } finally {
        busy.value = false;
      }
    }

    function openTaskSuppression(task: TaskRecord): void {
      if (busy.value || blockedByActive()) return;
      suppression.value = { kind: "task", task };
    }

    async function openDomainSuppression(): Promise<void> {
      if (busy.value || !domain.value || blockedByActive()) return;
      busy.value = true;
      message.value = "";
      try {
        const selected = domain.value;
        if (!sameDomainKey(selected, getDomainKeyFromHostname(selected.value))) {
          throw new PopupOperationError("INVALID_DOMAIN");
        }
        const matching = (await queryDomainSuppressions())
          .filter((entry) => sameDomainKey(selected, getDomainKeyFromHostname(entry.hostname)));
        const until = matching.reduce<string | null>(
          (latest, entry) => latest === null || entry.suppressedUntil > latest ? entry.suppressedUntil : latest,
          null,
        );
        suppression.value = { kind: "domain", domain: selected, until };
      } catch (error) {
        await showFailure(error);
      } finally {
        busy.value = false;
      }
    }

    async function confirm(value: Confirmation): Promise<void> {
      if (busy.value || (value.kind === "task" && blockedByActive())) return;
      confirmation.value = value;
      await nextTick();
      cancelElement.value?.focus();
    }

    async function closeConfirmation(): Promise<void> {
      const taskId = confirmation.value?.kind === "task" ? confirmation.value.task.id : null;
      confirmation.value = null;
      await nextTick();
      if (taskId && deleteButtons.has(taskId)) deleteButtons.get(taskId)?.focus();
      else filterElement.value?.focus();
    }

    function trapConfirmationFocus(event: KeyboardEvent): void {
      if (event.key !== "Tab" || busy.value) return;
      event.preventDefault();
      if (document.activeElement === cancelElement.value) confirmElement.value?.focus();
      else cancelElement.value?.focus();
    }

    async function applyConfirmation(): Promise<void> {
      const current = confirmation.value;
      if (!current || busy.value) return;
      busy.value = true;
      try {
        if (current.kind === "task") {
          await request("TASK_DELETE", { id: current.task.id, expectedRevision: current.task.revision });
        } else {
          await request("DISCARD_DRAFT", current.active.operation);
        }
        confirmation.value = null;
        await loadTasks();
      } catch (error) {
        confirmation.value = null;
        await showFailure(error);
      } finally {
        busy.value = false;
      }
    }

    async function finishEditing(): Promise<void> {
      editing.value = null;
      await loadTasks();
    }

    async function finishSuppression(): Promise<void> {
      suppression.value = null;
      await loadTasks();
    }

    onMounted(loadTasks);

    return () => {
      if (editing.value) return h(TaskEditor, { active: editing.value, onFinished: finishEditing });
      if (suppression.value) {
        return h(SuppressionEditor, { target: suppression.value, onFinished: finishSuppression });
      }
      if (confirmation.value) {
        const current = confirmation.value;
        return h("section", {
          class: "popup", role: "dialog", "aria-modal": "true",
          "aria-labelledby": "confirm-title", onKeydown: trapConfirmationFocus,
        }, [
          h("h1", { id: "confirm-title" }, current.kind === "task" ? "タスクの削除" : "途中入力の破棄"),
          h("p", current.kind === "task"
            ? `「${current.task.name}」を削除します。画像も削除されます。`
            : "保存済みの途中入力と関連する撮影結果が削除されます。"),
          h("button", {
            ref: cancelElement, type: "button", disabled: busy.value,
            "data-testid": "confirm-cancel", onClick: closeConfirmation,
          }, "キャンセル"),
          h("button", {
            ref: confirmElement, type: "button", disabled: busy.value,
            "data-testid": "confirm-apply", onClick: applyConfirmation,
          }, current.kind === "task" ? "削除" : "破棄"),
        ]);
      }
      return h("section", { class: "popup" }, [
        h("h1", "タスク一覧"),
        state.value === "loading"
          ? h("p", { "data-testid": "task-loading", role: "status" }, "読み込み中")
          : state.value === "error"
            ? h("div", [
              h("p", {
                ref: errorElement, class: "error", role: "alert", tabindex: -1, "data-testid": "task-error",
              }, message.value),
              h("button", { type: "button", "data-testid": "task-retry", onClick: loadTasks }, "再試行"),
            ])
            : h("div", [
              message.value ? h("div", [
                h("p", { ref: errorElement, class: "error", role: "alert", tabindex: -1,
                  "data-testid": "task-operation-error" }, message.value),
                h("button", { type: "button", onClick: loadTasks }, "一覧を再読み込み"),
              ]) : null,
              active.value ? h("section", { "data-testid": "active-draft" }, [
                h("p", "登録または編集が進行中です。保存済みの途中入力を再開または破棄できます。"),
                h("button", { type: "button", disabled: busy.value, "data-testid": "draft-resume", onClick: resume }, "再開"),
                h("button", {
                  type: "button", disabled: busy.value, "data-testid": "draft-discard",
                  onClick: () => active.value && confirm({ kind: "draft", active: active.value }),
                }, "破棄"),
              ]) : null,
              h("label", [
                "完了状態",
                h("select", { ref: filterElement, value: completion.value,
                  "data-testid": "completion-filter", onChange: selectCompletion }, [
                  h("option", { value: "all" }, "全件"),
                  h("option", { value: "open" }, "未完了"),
                  h("option", { value: "completed" }, "完了"),
                ]),
              ]),
              h("label", [
                "対象ドメイン",
                h("select", { value: domain.value ? domainValue(domain.value) : "",
                  "data-testid": "domain-filter", onChange: selectDomain }, [
                  h("option", { value: "" }, "全件"),
                  ...list.value.domains.map((option) => h("option", { value: domainValue(option.key) }, option.label)),
                ]),
              ]),
              domain.value ? h("button", {
                type: "button", disabled: busy.value, "data-testid": "domain-suppression",
                onClick: openDomainSuppression,
              }, "対象ドメインのリマインド停止") : null,
              list.value.emptyState
                ? h("p", { "data-testid": "task-empty" }, list.value.emptyState === "no-tasks"
                  ? "タスクはありません。" : "条件に一致するタスクはありません。")
                : h("ul", { "data-testid": "task-list" }, list.value.tasks.map((task) =>
                  h("li", { key: task.id, "data-testid": "task-item" }, [
                    h("strong", task.name),
                    h("p", `対象ドメイン: ${getDomainKeyFromHostname(task.hostname).value}`),
                    h("p", `期限: ${task.dueDate ?? "なし"}`),
                    h("p", `${task.completed ? "完了" : "未完了"}${isTaskOverdue(task, new Date()) ? "（期限超過）" : ""}`),
                    h("button", { type: "button", disabled: busy.value,
                      "data-testid": "task-edit", onClick: () => startEdit(task) }, "編集"),
                    h("button", { type: "button", disabled: busy.value,
                      "data-testid": "task-toggle", onClick: () => toggle(task) },
                    task.completed ? "未完了にする" : "完了にする"),
                    h("button", { type: "button", disabled: busy.value,
                      "data-testid": "task-suppression", onClick: () => openTaskSuppression(task) }, "リマインド停止"),
                    h("button", { type: "button", disabled: busy.value,
                      ref: (element: unknown) => {
                        if (element instanceof HTMLButtonElement) deleteButtons.set(task.id, element);
                        else deleteButtons.delete(task.id);
                      },
                      "data-testid": "task-delete", onClick: () => confirm({ kind: "task", task }) }, "削除"),
                  ]),
                )),
            ]),
      ]);
    };
  },
}).mount("#app");
