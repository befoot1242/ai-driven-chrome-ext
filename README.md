# ai-driven-chrome-ext

要件定義からテストまでを AI エージェント（主に GitHub Copilot）と一気通貫で進めるための、Chrome 拡張機能（Manifest V3）プロジェクトのひな形です。

## 構成の考え方

| 何を | どこに | 誰が読む |
|---|---|---|
| AI 向けの地図・工程ルール | `AGENTS.md` | AI（Copilot / Claude Code / Kiro 共通） |
| 全工程共通の前提 | `docs/00_steering/` | 人・AI |
| 要件（機能 / 非機能） | `docs/10_requirements/` | 人・AI |
| 基本設計 / 詳細設計 / テスト設計 | `docs/20_〜40_` | 人・AI |
| 設計判断 | `docs/80_decisions/`（ADR） | 人・AI |
| 外部参照ドキュメント | `docs/90_references/` | 人・AI |
| 実装ルール / テストルール / IaC ルール | `.github/instructions/` | AI（該当ファイル編集時に自動適用）・人 |
| 工程ごとのプロンプト | `.github/prompts/` | AI |
| 実装 / テスト / IaC | `src/` `tests/` `infra/` | - |

詳しくは `docs/00_steering/structure.md` と `docs/80_decisions/ADR-0001_adopt-ai-driven-structure.md` を参照。

## はじめかた

```bash
npm install
npx playwright install chromium   # E2E を使う場合
npm run lint && npm run test && npm run build
npm run test:e2e
npm run trace
```

E2E はビルド済みの拡張機能を Playwright の Chromium に読み込んで実行します。
現時点の E2E は通信の異常系のみで、タスク管理機能全体の動作を確認したものではありません。

## 開発の流れ（1 機能あたり）

Copilot Chat（エージェントモード）で `/` から各プロンプトを実行します。

| 工程 | プロンプト | 成果物 | 人の作業 |
|---|---|---|---|
| 1. 機能要件 | `/01-req-functional` | `FR-NNN` | レビューして `status: approved` |
| 2. 非機能要件 | `/02-req-non-functional` | `NFR-*` | 同上 |
| 3. 基本設計 | `/03-basic-design` | `BD-NNN`（+ ADR） | 同上 |
| 4. 詳細設計 | `/04-detail-design` | `DD-<機能>-NNN` | 同上 |
| 5. テスト設計 | `/05-test-design` | `TS-NNN` | 同上 |
| 6. 実装・テスト | `/06-implement` | `src/` `tests/` | コードレビュー |

- 各工程の後、`design-reviewer` エージェントでレビューさせると効率的です。
- **`status: approved` にするのは人だけ**です。AI は上流が approved でないと下流を作りません（`AGENTS.md` の承認ゲート）。
- `npm run trace` で `docs/traceability.md` が更新され、承認ゲート違反や設計漏れが一覧で出ます。CI では `trace:check` で失敗させます。

## 次にやること

1. タスク管理機能の要件を確認し、承認する
2. UI 技術（素の DOM / Vue 3 など）を決めて ADR-0002 を書く
3. 承認された要件に基づいて基本設計以降を進める
