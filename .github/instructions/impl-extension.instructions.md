---
applyTo: "src/**"
---

# 実装ルール（Chrome 拡張 / Manifest V3 固有）

## 実行コンテキスト

| フォルダ | コンテキスト | 注意点 |
|---|---|---|
| `src/background/` | Service Worker | 常駐しない。グローバル変数に状態を持たない。状態は `chrome.storage` に保存する |
| `src/content/` | コンテンツスクリプト | ページの DOM にアクセスできるが、拡張 API の一部しか使えない |
| `src/popup/` | ポップアップ | 閉じると破棄される。長い処理は background に任せる |
| `src/options/` | オプションページ | 設定の読み書きのみ |
| `src/shared/` | どこからでも使う共通処理 | `chrome.*` に直接依存しない |

## 必須ルール

- コンテキスト間の通信はメッセージ（`chrome.runtime.sendMessage` / `chrome.tabs.sendMessage`）で行い、メッセージ型は `src/shared/messages.ts` に集約する。
- イベントリスナーは Service Worker のトップレベルで同期的に登録する。
- `setTimeout` / `setInterval` で長時間の待機をしない。定期処理は `chrome.alarms` を使う。
- リモートコード（外部 JS の読み込み、`eval`、`new Function`）は禁止。
- `manifest.json` の `permissions` / `host_permissions` は、基本設計の「権限一覧」（BD）にあるものだけにする。追加が必要なら先に BD の変更を提案する。
- ユーザー入力やページの内容を `innerHTML` に入れない。
