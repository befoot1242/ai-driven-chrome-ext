// @trace DD-counter-001
// コンテキスト間メッセージの型定義。メッセージはここに集約する（impl-extension.instructions.md）。

export type Message =
  | { type: 'PING' }
  | { type: 'GET_COUNT' }
  | { type: 'INCREMENT' };

export type MessageResponse<M extends Message> = M extends { type: 'PING' }
  ? { ok: true }
  : M extends { type: 'GET_COUNT' | 'INCREMENT' }
    ? { count: number }
    : never;
