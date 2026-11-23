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
