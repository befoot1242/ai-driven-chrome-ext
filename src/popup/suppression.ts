// @trace DD-task-002 DD-task-001 DD-communication-001
import { defineComponent, h, nextTick, onMounted, ref, type PropType } from "vue";
import type { DomainKey } from "../shared/domain-types";
import { getCurrentTimeZone, getLocalTimeCandidates, type LocalTimeCandidate } from "../shared/local-time";
import type { TaskRecord } from "../shared/task-types";
import { operationErrorMessage, request } from "./popup-api";

export type SuppressionTarget =
  | { kind: "task"; task: TaskRecord }
  | { kind: "domain"; domain: DomainKey; until: string | null };

function suppressionErrorMessage(cause: unknown): string {
  const message = operationErrorMessage(cause);
  return message === "操作に失敗しました。"
    ? "停止設定を変更できませんでした。原因を特定できませんでした。"
    : message;
}

export const SuppressionEditor = defineComponent({
  props: {
    target: { type: Object as PropType<SuppressionTarget>, required: true },
  },
  emits: ["finished"],
  setup(props, { emit }) {
    const date = ref("");
    const time = ref("");
    const timeZone = ref("");
    const candidates = ref<LocalTimeCandidate[]>([]);
    const selected = ref("");
    const error = ref("");
    const busy = ref(false);
    const errorElement = ref<HTMLElement | null>(null);
    const dateElement = ref<HTMLInputElement | null>(null);
    const timeElement = ref<HTMLInputElement | null>(null);
    let candidateZone = "";

    onMounted(() => {
      try {
        timeZone.value = getCurrentTimeZone();
      } catch {
        error.value = "日時の変換機能を利用できません。";
      }
    });

    function changeInput(field: "date" | "time", event: Event): void {
      if (!(event.target instanceof HTMLInputElement)) return;
      if (field === "date") date.value = event.target.value;
      else time.value = event.target.value;
      candidates.value = [];
      selected.value = "";
      candidateZone = "";
      error.value = "";
    }

    async function fail(message: string, field?: "date" | "time"): Promise<void> {
      error.value = message;
      busy.value = false;
      await nextTick();
      if (field === "date") dateElement.value?.focus();
      else if (field === "time") timeElement.value?.focus();
      else errorElement.value?.focus();
    }

    async function update(until: string | null): Promise<void> {
      const target = props.target;
      const payload = target.kind === "task"
        ? { kind: "task", id: target.task.id, expectedRevision: target.task.revision, until }
        : { kind: "domain", hostname: target.domain.value, domain: target.domain, until };
      await request("SUPPRESSION_UPDATE", payload);
      emit("finished");
    }

    async function save(): Promise<void> {
      if (busy.value) return;
      busy.value = true;
      try {
        const zone = getCurrentTimeZone();
        if ((timeZone.value && timeZone.value !== zone) || (candidateZone && candidateZone !== zone)) {
          candidates.value = [];
          selected.value = "";
          candidateZone = "";
          timeZone.value = zone;
          await fail("タイムゾーンが変わりました。日時を再確認してください。");
          return;
        }
        timeZone.value = zone;
        if (!date.value) {
          await fail("停止終了日を入力してください。", "date");
          return;
        }
        if (!time.value) {
          await fail("停止終了時刻を入力してください。", "time");
          return;
        }
        const choices = getLocalTimeCandidates(date.value, time.value, zone);
        if (choices.length === 0) {
          await fail("この日時は現在のタイムゾーンに存在しません。別の日時を入力してください。", "date");
          return;
        }
        if (choices.length > 2) throw new Error("日時の候補を確認できません。");
        if (choices.length === 2) {
          candidates.value = choices;
          candidateZone = zone;
          if (!choices.some((candidate) => candidate.instant === selected.value)) {
            selected.value = "";
            await fail("この日時は2回あります。どちらかを選択してください。");
            return;
          }
        }
        const until = choices.length === 1 ? choices[0]?.instant : selected.value;
        if (!until) throw new Error("日時の候補を確認できません。");
        if (Date.parse(until) <= Date.now()) {
          await fail("停止終了日時には、現在より後の日時を入力してください。", "date");
          return;
        }
        if (getCurrentTimeZone() !== zone) {
          candidates.value = [];
          selected.value = "";
          candidateZone = "";
          timeZone.value = getCurrentTimeZone();
          await fail("タイムゾーンが変わりました。日時を再確認してください。");
          return;
        }
        await update(until);
      } catch (cause) {
        console.error("SUPPRESSION_UPDATE_FAILED");
        if (cause instanceof RangeError) {
          await fail("日付または時刻の形式が不正です。", "date");
        } else if (cause instanceof Error && cause.message === "日時の変換機能を利用できません。") {
          await fail(cause.message);
        } else {
          await fail(suppressionErrorMessage(cause));
        }
      } finally {
        busy.value = false;
      }
    }

    async function clear(): Promise<void> {
      if (busy.value) return;
      busy.value = true;
      try {
        await update(null);
      } catch (cause) {
        console.error("SUPPRESSION_UPDATE_FAILED");
        await fail(suppressionErrorMessage(cause));
      } finally {
        busy.value = false;
      }
    }

    return () => {
      const target = props.target;
      const until = target.kind === "task" ? target.task.reminderSuppressedUntil : target.until;
      return h("section", { class: "popup" }, [
        h("h1", "リマインド停止設定"),
        h("p", target.kind === "task" ? `タスク: ${target.task.name}` : `対象ドメイン: ${target.domain.value}`),
        target.kind === "domain"
          ? h("p", `基準ホスト: ${target.domain.value}。判定ルールの更新により停止対象が変わる場合があります。`)
          : null,
        h("p", { "data-testid": "suppression-current" }, until
          ? `現在の設定: ${new Intl.DateTimeFormat("ja-JP", {
            year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit",
            minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3, timeZoneName: "short",
          }).format(new Date(until))}`
          : "現在の設定: なし"),
        h("p", { "data-testid": "suppression-zone" }, `タイムゾーン: ${timeZone.value || "取得できません"}`),
        h("label", [
          "停止終了日",
          h("input", { ref: dateElement, type: "date", value: date.value, disabled: busy.value,
            "data-testid": "suppression-date", onInput: (event: Event) => changeInput("date", event) }),
        ]),
        h("label", [
          "停止終了時刻",
          h("input", { ref: timeElement, type: "time", step: 60, value: time.value, disabled: busy.value,
            "data-testid": "suppression-time", onInput: (event: Event) => changeInput("time", event) }),
        ]),
        error.value ? h("p", {
          ref: errorElement, class: "error", role: "alert", tabindex: -1, "data-testid": "suppression-error",
        }, error.value) : null,
        candidates.value.length === 2 ? h("fieldset", [
          h("legend", "どちらの日時か選択してください"),
          ...candidates.value.map((candidate) => h("label", { key: candidate.instant }, [
            h("input", {
              type: "radio", name: "suppression-candidate", value: candidate.instant,
              checked: selected.value === candidate.instant, disabled: busy.value,
              "data-testid": "suppression-candidate",
              onChange: () => { selected.value = candidate.instant; },
            }),
            `UTC${candidate.offset}（${candidate.instant}）`,
          ])),
        ]) : null,
        h("button", { type: "button", disabled: busy.value, "data-testid": "suppression-save", onClick: save }, "設定・変更"),
        h("button", { type: "button", disabled: busy.value, "data-testid": "suppression-clear", onClick: clear }, "解除"),
        h("button", { type: "button", disabled: busy.value, "data-testid": "suppression-cancel",
          onClick: () => emit("finished") }, "キャンセル"),
      ]);
    };
  },
});
