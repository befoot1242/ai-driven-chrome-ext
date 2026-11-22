---
applyTo: "src/**"
---

# 実装ルール（共通）

## 着手前

- 実装対象の詳細設計（`docs/30_detail-design/`）の `status` が `approved` であることを確認する。そうでなければ実装しない。
- ファイル先頭に対応する設計 ID を書く: `// @trace DD-login-002`

## TypeScript

- `strict: true` 前提。`any` は禁止（やむを得ない場合は `unknown` ＋型ガード）。
- `export default` は使わず名前付き export にする。
- 非同期処理は `async/await`。Promise を投げっぱなしにしない。
- 例外は握りつぶさない。ユーザーに見せるエラーと開発者向けログを分ける。

## 命名

- ファイル: kebab-case（`tab-state.ts`）
- 型・クラス: PascalCase
- 関数・変数: camelCase
- 定数: UPPER_SNAKE_CASE

## 構成

- 純粋なロジックは `src/shared/` に置き、`chrome.*` API に依存させない（単体テストしやすくするため）。
- `chrome.*` API の呼び出しは薄いラッパー（`src/shared/chrome/`）経由にする。
- ここに書かれていないルールが必要になったら、追記を提案する（勝手に独自ルールを作らない）。
