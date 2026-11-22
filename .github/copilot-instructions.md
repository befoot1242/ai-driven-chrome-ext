# Copilot リポジトリ共通指示

工程ルールとファイル配置はリポジトリ直下の `AGENTS.md` を正とする。必ず従うこと。

## 技術スタック

- Chrome 拡張機能 Manifest V3
- TypeScript（strict）
- ビルド: Vite
- 単体テスト: Vitest
- E2E テスト: Playwright（拡張機能を読み込んだ Chromium）
- IaC（バックエンドが必要な場合のみ）: AWS CDK（TypeScript）

## コマンド

- ビルド: `npm run build`
- 単体テスト: `npm run test`
- E2E: `npm run test:e2e`
- Lint: `npm run lint`
- トレーサビリティ更新: `npm run trace`

## 応答ルール

- 回答・設計書・コードコメントは日本語で書く。識別子は英語。
- 不明点や上流文書との矛盾を見つけたら、推測で埋めずに質問する。
- 変更を提案するときは、関係する上流 ID（FR/BD/DD/TS）を明記する。
