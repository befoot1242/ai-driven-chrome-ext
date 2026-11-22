---
mode: agent
description: 承認済みの要件から基本設計（BD）を作成する
---

# 基本設計の作成

## 入力

- 対象要件: ${input:ids:FR/NFR の ID（カンマ区切り）}

## 手順

1. 対象の FR / NFR を読み、すべて `status: approved` であることを確認する。**1 つでも approved でなければ、ここで止めて報告する。**
2. `docs/20_basic-design/_template.md` に従い BD 文書を作成する。`trace` に対象要件 ID を入れる。
3. 必ず次を含める。
   - 画面一覧・画面遷移（popup / options / コンテンツスクリプトの UI）
   - 実行コンテキスト間のメッセージ一覧
   - **権限一覧（permission ごとに必要な理由と対応 FR）**
   - 保存データ（`chrome.storage` のキー・型・保存先 local/sync/session）
   - 外部インターフェース（呼び出す外部 API があれば）
4. 技術的な選択肢が複数ある判断は、`docs/80_decisions/` に ADR 案を作成する。
5. 外部仕様を根拠にした箇所は `REF-NNN` を付け、`docs/90_references/index.md` に追記する。
6. 要件で満たせていない点・矛盾点を末尾に列挙する。
