---
applyTo: "tests/**"
---

# テストルール

## 基本

- テストは対応するテスト設計（`docs/40_test-design/` の `TS-NNN`）に基づいて書く。
- `describe` 名の先頭に TS の ID を書く: `describe('TS-015 ログイン状態の表示', ...)`
- テスト設計に無いテストを追加した場合は、テスト設計への追記を提案する。

## 単体テスト（`tests/unit/`、Vitest）

- 対象は主に `src/shared/` の純粋ロジック。
- `chrome.*` API はラッパーをモックする。グローバルの `chrome` を直接書き換えない。
- 1 テスト 1 観点。Arrange / Act / Assert の順に書く。
- 境界値（0、1、上限、上限+1、空、null）を必ず含める。

## E2E テスト（`tests/e2e/`、Playwright）

- `dist/` をビルドした拡張機能を読み込んだ Chromium で実行する。
- セレクタは `data-testid` を使う。CSS クラスや文言に依存しない。
- 固定の `waitForTimeout` は禁止。状態を待つ（`expect(...).toBeVisible()` など）。

## 禁止事項

- テストを通すためにテスト対象コードやテストの期待値を書き換えること（失敗したら原因を報告する）
- `skip` / `only` を残したままのコミット
