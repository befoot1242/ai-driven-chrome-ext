// @trace DD-task-001 DD-task-002

export interface TaskFormFields {
  name: string;
  url: string;
  dueDate: string | null;
  detail: string;
}

export interface TaskFormErrors {
  name?: string;
  url?: string;
  dueDate?: string;
}

function isValidTaskDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validateTaskForm(fields: TaskFormFields): {
  errors: TaskFormErrors;
  hostname: string | null;
} {
  const errors: TaskFormErrors = {};
  let hostname: string | null = null;
  if (!fields.name.trim()) errors.name = "タスク名を入力してください。";
  try {
    const url = new URL(fields.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      errors.url = "HTTPまたはHTTPSのURLを入力してください。";
    } else {
      hostname = url.hostname;
    }
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    errors.url = "有効なURLを入力してください。";
  }
  if (fields.dueDate !== null && !isValidTaskDate(fields.dueDate)) {
    errors.dueDate = "有効な日付を入力してください。";
  }
  return { errors, hostname };
}
