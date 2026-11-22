---
id: ADR-0003
title: タスクと画像の端末内保存に IndexedDB を用いる案
status: draft
trace: [FR-002, FR-003, NFR-AVL-001, NFR-AVL-002]
owner: ""
updated: 2026-11-23
---

# ADR-0003 タスクと画像の端末内保存に IndexedDB を用いる案

## 状況

タスクと画像を端末内で保持し、合計100MBまで保存できる必要がある。画像は1枚あたり最大5MBである。

## 決定

拡張機能オリジンの IndexedDB にタスクと画像 Blob を保存し、`unlimitedStorage` 権限を使用する案とする。Chrome は拡張機能の IndexedDB を Service Worker から利用でき、`unlimitedStorage` は容量制限と退避に影響する（REF-014）。利用者はこの方式を選択した。

比較対象の `chrome.storage.local` は JSON で保存し、既定の容量制限を超えるには `unlimitedStorage` が必要である（REF-020）。画像のバイナリ保存とトランザクションを扱える点から IndexedDB を提案する。

## 結果

- タスクと画像をトランザクションで扱う設計が可能になる。
- 100MB の測定方法、空き容量不足時の処理、データ移行と復旧の詳細は未決。
- Service Worker の停止を前提に状態を管理する。利用者による削除・アンインストール、端末故障等の扱いは NFR-AVL-002 に従う。

## 変更履歴

| 日付 | 変更者 | 内容 |
|---|---|---|
| 2026-11-23 | AI | 初版案 |
