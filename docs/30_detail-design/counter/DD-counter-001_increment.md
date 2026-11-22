---
id: DD-counter-001
title: （サンプル）カウント加算処理
status: review
trace: [BD-001]
owner: "sample"
updated: 2026-11-22
---

# DD-counter-001 （サンプル）カウント加算処理

## 1. 概要

BD-001 の「カウント加算」を実装レベルまで具体化する。

## 2. モジュール構成

| ファイル | 役割 |
|---|---|
| `src/shared/counter.ts` | 加算ロジック（chrome.* 非依存） |
| `src/shared/chrome/storage.ts` | chrome.storage のラッパー |
| `src/shared/messages.ts` | メッセージ型 |
| `src/background/service-worker.ts` | メッセージ受信・保存 |
| `src/popup/main.ts` | 表示とボタン操作 |

## 3. インターフェース

```ts
export const MAX_COUNT = 999;
export function increment(current: number): number;
```

## 4. 処理詳細

1. 現在値が 0 以上の整数でなければ `RangeError` を投げる
2. `min(current + 1, MAX_COUNT)` を返す

## 5. 状態遷移

該当なし

## 6. エラー処理

| エラー | 検知方法 | ユーザーへの表示 | ログ |
|---|---|---|---|
| 不正な保存値 | `RangeError` | なし（TODO: 表示方針を決める） | console.error |

## 7. ログ出力

該当なし

## 8. テスト観点

- 正常系: 0 → 1
- 異常系: 負の値
- 境界値: 998 → 999、999 → 999

## 9. 未決事項

- 不正な保存値の場合のユーザー表示

## 変更履歴

| 日付 | 変更者 | 内容 |
|---|---|---|
| 2026-11-22 | sample | 初版 |
