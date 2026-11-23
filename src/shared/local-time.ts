// @trace DD-task-001 DD-task-002

interface ZonedDateTimeValue {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  offset: string;
  epochMilliseconds: number;
}

interface TemporalApi {
  ZonedDateTime: {
    from(
      fields: {
        timeZone: string;
        year: number;
        month: number;
        day: number;
        hour: number;
        minute: number;
      },
      options: { overflow: "reject"; disambiguation: "earlier" | "later" },
    ): ZonedDateTimeValue;
  };
}

declare const Temporal: TemporalApi | undefined;

export interface LocalTimeCandidate {
  instant: string;
  offset: string;
}

export function getLocalTimeCandidates(
  date: string,
  time: string,
  timeZone: string,
): LocalTimeCandidate[] {
  if (typeof Temporal === "undefined") {
    throw new Error("日時の変換機能を利用できません。");
  }

  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeParts = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateParts || !timeParts) {
    throw new RangeError("日付または時刻の形式が不正です。");
  }

  const fields = {
    timeZone,
    year: Number(dateParts[1]),
    month: Number(dateParts[2]),
    day: Number(dateParts[3]),
    hour: Number(timeParts[1]),
    minute: Number(timeParts[2]),
  };
  const candidates = (["earlier", "later"] as const).map((disambiguation) =>
    Temporal.ZonedDateTime.from(fields, { overflow: "reject", disambiguation }),
  );
  const valid = candidates.filter(
    (value) =>
      value.year === fields.year &&
      value.month === fields.month &&
      value.day === fields.day &&
      value.hour === fields.hour &&
      value.minute === fields.minute,
  );
  return valid
    .filter((value, index) => valid.findIndex((other) => other.epochMilliseconds === value.epochMilliseconds) === index)
    .map((value) => ({
      instant: new Date(value.epochMilliseconds).toISOString(),
      offset: value.offset,
    }));
}
