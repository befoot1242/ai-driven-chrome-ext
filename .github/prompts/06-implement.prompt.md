---
mode: agent
description: 承認済みの詳細設計・テスト設計に基づいて実装とテストを行う
---

# 実装

## 入力

- 対象詳細設計: ${input:dd:DD の ID}
- 対象テスト設計: ${input:ts:TS の ID}

## 手順

1. DD と TS が `status: approved` であることを確認する。そうでなければ止める。
2. 実装計画（変更するファイルと内容の要約）を先に示し、確認を得る。
3. テストを先に書く（TS に基づく）。失敗することを確認する。
4. 実装する。各ファイル先頭に `// @trace DD-xxx` を書く。
5. `npm run lint && npm run test` を実行し、すべて通るまで修正する。テストの期待値を書き換えて通すことは禁止。
6. `npm run trace` を実行して `docs/traceability.md` を更新する。
7. DD と実装に差異が出た場合は、DD の修正案を示す（DD を勝手に approved のまま書き換えない）。
