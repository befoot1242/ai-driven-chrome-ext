// @trace DD-task-001

export interface TaskRecord {
  id: string;
  url: string;
  hostname: string;
  name: string;
  dueDate: string | null;
  detail: string;
  completed: boolean;
  createdAt: string;
  reminderSuppressedUntil: string | null;
  revision: number;
}

export interface ImageRecord {
  id: string;
  taskId: string;
  position: number;
  data: Blob;
}

export interface DomainSuppressionRecord {
  hostname: string;
  suppressedUntil: string;
}

export interface DraftFields {
  name: string;
  url: string;
  dueDate: string;
  detail: string;
}

export interface Draft {
  id: string;
  kind: "registration" | "edit";
  taskId: string;
  baseRevision: number | null;
  fields: DraftFields;
  images: ImageRecord[];
}

export interface OperationRef {
  id: string;
  generation: number;
}
