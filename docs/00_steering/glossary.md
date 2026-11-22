# 用語集（glossary.md）

| 用語 | 英語 / 識別子 | 定義 | 備考 |
|---|---|---|---|
| 拡張機能 | extension | 本プロジェクトで開発する Chrome 拡張機能 | |
| Service Worker | background | 拡張機能のバックグラウンド処理。常駐しない | MV3 |
| コンテンツスクリプト | content script | Web ページに注入されて動くスクリプト | |
| ポップアップ | popup | ツールバーのアイコンを押すと開く画面 | |
| 承認ゲート | approval gate | 上流文書が `approved` になるまで下流工程に進まないルール | AGENTS.md 参照 |
| タスク | task | Web ページに関連付けて登録する作業 | タスク名、期限、詳細、画像などを持つ |
| 対象ドメイン | target domain | リマインド対象を判定する、サブドメインを含むサイトの範囲 | 例: `www.example.com` と `shop.example.com` は同じ対象 |
| リマインド停止期間 | reminder suppression period | 指定したタスクまたは対象ドメインのリマインドを表示しない期間 | |
