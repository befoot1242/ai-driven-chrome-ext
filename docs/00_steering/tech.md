# 技術スタック（tech.md）

> AI はここに無い技術・ライブラリを勝手に導入しない。追加が必要なら ADR を提案する。

| 区分 | 採用技術 | バージョン方針 | 採用理由 / ADR |
|---|---|---|---|
| プラットフォーム | Chrome 拡張機能 Manifest V3 | - | MV2 は廃止済み |
| 言語 | TypeScript | 5.x、`strict: true` | |
| ビルド | Vite | 最新安定版 | |
| 単体テスト | Vitest | 最新安定版 | |
| E2E テスト | Playwright | 最新安定版 | 拡張機能を読み込んだ Chromium でテストできる |
| Lint / Format | ESLint / Prettier | 最新安定版 | |
| UI | TODO（素の DOM / Vue 3 など） | | ADR で決定 |
| バックエンド | なし（必要になったら AWS） | | |
| IaC | AWS CDK（TypeScript） | v2 | バックエンドが必要な場合のみ |
| CI | GitHub Actions | | |

## 技術的な制約

- リモートコードの実行は禁止（MV3 の制約）
- Service Worker は常駐しない前提で設計する
- 依存ライブラリは EOL・ライセンスを確認してから追加する
