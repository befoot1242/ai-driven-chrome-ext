---
mode: agent
description: 非機能要件（NFR）を作成・更新する
---

# 非機能要件の作成

## 入力

- 対象: ${input:scope:対象の機能 ID または「全体」}
- 参照: `docs/00_steering/product.md`, `docs/00_steering/tech.md`, `docs/10_requirements/`

## 手順

1. 次の分類ごとに、要件が必要かどうかを判断する（IPA「非機能要求グレード」の大項目を参考にした分類）。
   - `PERF` 性能・拡張性 / `AVL` 可用性 / `SEC` セキュリティ / `OPS` 運用・保守性 / `UX` 使用性・アクセシビリティ / `CMP` 移行性・互換性（対応ブラウザ・バージョン）
2. 必要な分類について `docs/10_requirements/non-functional/_template.md` に従い文書を作成する。
   - 必ず測定可能な目標値と、その測定方法を書く。
   - 根拠となる FR があれば `trace` に入れる。
3. Chrome 拡張では特に次を検討する: 要求する権限の最小化、Chrome Web Store のポリシー、扱う個人情報、対応 Chrome バージョン。
4. 判断に迷う目標値は「案」として複数示し、人間に選んでもらう。
