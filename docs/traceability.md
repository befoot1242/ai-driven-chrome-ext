# トレーサビリティ表

> このファイルは `npm run trace` で自動生成されます。手で編集しないでください。

| 要件 | 基本設計 | 詳細設計 | テスト設計 | 実装 | テストコード |
|---|---|---|---|---|---|
| FR-001 (approved) （サンプル）クリック回数のカウント | BD-001 (approved) | DD-counter-001 (review) | TS-001 (draft) | `src/background/service-worker.ts`<br>`src/content/content.ts`<br>`src/popup/main.ts`<br>`src/shared/chrome/storage.ts`<br>`src/shared/counter.ts`<br>`src/shared/messages.ts` | `tests/e2e/popup.spec.ts`<br>`tests/unit/counter.test.ts` |

## 検出された問題（2 件）

- 未承認の設計に基づくコード/テストがあります: DD-counter-001(review) ← src/background/service-worker.ts, src/content/content.ts, src/popup/main.ts, src/shared/chrome/storage.ts, src/shared/counter.ts, src/shared/messages.ts
- 未承認の設計に基づくコード/テストがあります: TS-001(draft) ← tests/e2e/popup.spec.ts, tests/unit/counter.test.ts
