# リポジトリ構成規約（structure.md）

```
.
├─ AGENTS.md                  # AI 向けの地図と工程ルール
├─ .github/
│  ├─ copilot-instructions.md # Copilot 共通指示
│  ├─ instructions/           # 実装・テスト・IaC・設計書のルール（applyTo で自動適用）
│  ├─ prompts/                # 工程ごとの実行プロンプト（01〜06）
│  └─ agents/                 # 専門エージェント（レビュー担当など）
├─ docs/
│  ├─ 00_steering/            # 全工程共通の前提
│  ├─ 10_requirements/
│  │  ├─ functional/          # FR-NNN
│  │  └─ non-functional/      # NFR-<分類>-NNN
│  ├─ 20_basic-design/        # BD-NNN
│  ├─ 30_detail-design/<機能>/ # DD-<機能>-NNN
│  ├─ 40_test-design/         # TS-NNN
│  ├─ 80_decisions/           # ADR-NNNN
│  ├─ 90_references/          # 外部参照（REF-NNN）
│  └─ traceability.md         # 自動生成
├─ src/
│  ├─ manifest.json
│  ├─ background/             # Service Worker
│  ├─ content/                # コンテンツスクリプト
│  ├─ popup/
│  ├─ options/
│  └─ shared/                 # 共通ロジック（chrome.* 非依存）
│     └─ chrome/              # chrome.* API の薄いラッパー
├─ tests/
│  ├─ unit/
│  └─ e2e/
├─ infra/                     # IaC（AWS CDK）
│  ├─ AGENTS.md
│  ├─ modules/
│  └─ envs/{dev,stg,prod}/
└─ scripts/
   └─ trace.mjs               # トレーサビリティ表の生成
```

## ルールの置き場所の原則

- **AI に守らせたいルールは `.github/instructions/` に置く**（ここが正本）。`docs/` に同じことを書かない。
- **何を作るか（What）は `docs/`、どう作るか（How）は `.github/instructions/`** と分ける。
- ルート `AGENTS.md` は短く保つ。領域固有の注意はその領域の `AGENTS.md`（例: `infra/AGENTS.md`）に書く。
