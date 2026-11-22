# AGENTS.md

このファイルは AI エージェント（GitHub Copilot / Claude Code / Kiro など）向けの「地図」と「工程ルール」です。
詳細なルールは各所のファイルに分けてあります。ここは短く保ってください。

## プロジェクト概要

- Chrome 拡張機能（Manifest V3）を AI 駆動で開発するプロジェクト
- 製品の目的・スコープ: `docs/00_steering/product.md`
- 技術スタック: `docs/00_steering/tech.md`
- リポジトリ構成規約: `docs/00_steering/structure.md`
- 用語集: `docs/00_steering/glossary.md`

## どこに何があるか

| 種別 | 場所 | ID 接頭辞 |
|---|---|---|
| 機能要件 | `docs/10_requirements/functional/` | `FR-` |
| 非機能要件 | `docs/10_requirements/non-functional/` | `NFR-<分類>-` |
| 基本設計 | `docs/20_basic-design/` | `BD-` |
| 詳細設計 | `docs/30_detail-design/<機能名>/` | `DD-<機能名>-` |
| テスト設計 | `docs/40_test-design/` | `TS-` |
| 設計判断 (ADR) | `docs/80_decisions/` | `ADR-` |
| 外部参照ドキュメント | `docs/90_references/index.md` | `REF-` |
| トレーサビリティ表 | `docs/traceability.md`（自動生成） | - |
| 実装ルール | `.github/instructions/impl-*.instructions.md` | - |
| テストルール | `.github/instructions/test.instructions.md` | - |
| IaC ルール | `.github/instructions/iac.instructions.md`, `infra/AGENTS.md` | - |
| 実装 | `src/` | - |
| テストコード | `tests/` | - |
| IaC | `infra/` | - |

## 工程ルール（承認ゲート）

1. 工程は 要件 → 基本設計 → 詳細設計 → テスト設計 → 実装/テスト の順に進める。
2. すべての設計書は先頭に front matter（`id` / `status` / `trace`）を持つ。書式は `.github/instructions/docs.instructions.md` に従う。
3. **上流文書の `status` が `approved` でない場合、その文書を元に下流文書やコードを作成してはならない。** 気づいたら作業を止め、人間に承認を依頼すること。
4. `status` を `approved` に変更するのは人間だけ。AI は `draft` → `review` までしか変更しない。
5. 下流文書・コード・テストには、必ず上流 ID を `trace` またはコメントで記載する。
   - コード: ファイル先頭コメントに `@trace DD-xxx`
   - テスト: `describe` 名またはコメントに `@trace TS-xxx`
6. 外部仕様（Chrome API 等）に依存する判断をしたら、`docs/90_references/index.md` に参照元を追記する。外部ドキュメントの本文は丸ごとコピーしない。
7. 作業後は `npm run trace` を実行し、`docs/traceability.md` を更新する。

## コマンド

```bash
npm install
npm run build      # 拡張機能をビルド（dist/）
npm run test       # 単体テスト
npm run test:e2e   # E2E テスト（Playwright）
npm run lint
npm run trace      # トレーサビリティ表を再生成・孤立 ID を検出
```

## やってはいけないこと

- `approved` でない設計を根拠にした実装
- `manifest.json` の `permissions` / `host_permissions` を、基本設計の権限一覧（BD）に無いまま追加すること
- リモートコードの読み込み（MV3 で禁止）
- `infra/envs/prod/` の直接変更（`infra/AGENTS.md` 参照）
