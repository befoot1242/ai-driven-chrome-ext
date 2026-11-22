# 外部参照ドキュメント一覧

> 外部ドキュメントの本文は丸ごとコピーしない。URL・参照した版・取得日を記録し、要点は `notes/` に自分の言葉でまとめる。
> 定期的に（目安: 四半期ごと）リンク先の更新を確認し、「最終確認日」を更新する。

| ID | 名称 | 発行元 | URL | 参照した版 / 日付 | 最終確認日 | 用途 / 参照元文書 | 要点メモ |
|---|---|---|---|---|---|---|---|
| REF-001 | AGENTS.md | Agentic AI Foundation（Linux Foundation） | https://agents.md/ | - | 2026-11-22 | ADR-0001 | |
| REF-002 | Copilot customization cheat sheet | GitHub | https://docs.github.com/en/copilot/reference/customization-cheat-sheet | - | 2026-11-22 | ADR-0001 | |
| REF-003 | Kiro Steering | AWS（Kiro） | https://kiro.dev/docs/steering/ | - | 2026-11-22 | ADR-0001 | |
| REF-004 | AI-DLC Workflows | AWS Labs | https://github.com/awslabs/aidlc-workflows | v2 | 2026-11-22 | ADR-0001 | |
| REF-005 | GitHub Spec Kit | GitHub | https://github.github.com/spec-kit/ | - | 2026-11-22 | ADR-0001 | |
| REF-006 | Chrome Extensions ドキュメント（MV3） | Google | https://developer.chrome.com/docs/extensions | - | 2026-11-22 | 実装ルール | |
| REF-007 | Chrome Web Store プログラムポリシー | Google | https://developer.chrome.com/docs/webstore/program-policies | - | 2026-11-22 | NFR-SEC 系 | |
| REF-008 | 公式サンプル chrome-extensions-samples | Google | https://github.com/GoogleChrome/chrome-extensions-samples | - | 2026-11-22 | 実装の参考 | |
| REF-009 | Content scripts | Google | https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts | - | 2026-11-23 | FR-004 | ページとコンテンツスクリプトは DOM を共有する |
| REF-010 | Stay secure | Google | https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure | - | 2026-11-23 | FR-004 | コンテンツスクリプトとページの相互作用に関する注意 |
| REF-011 | Tabs API | Google | https://developer.chrome.com/docs/extensions/reference/api/tabs | - | 2026-11-23 | BD-001 | タブの撮影と呼び出し制限 |
| REF-012 | activeTab | Google | https://developer.chrome.com/docs/extensions/develop/concepts/activeTab | - | 2026-11-23 | BD-001 | 一時的なタブアクセスと付与条件 |
| REF-013 | Web Navigation API | Google | https://developer.chrome.com/docs/extensions/reference/api/webNavigation | - | 2026-11-23 | BD-001 | ページ遷移イベントと権限 |
| REF-014 | Storage and cookies | Google | https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies | - | 2026-11-23 | BD-001、ADR-0003 | 拡張機能オリジンの保存と容量 |
| REF-015 | Public Suffix List: Learn more | Public Suffix List | https://publicsuffix.org/learn/ | - | 2026-11-23 | BD-001、ADR-0004 | ドメイン単位のグループ化 |
| REF-016 | Public Suffix List: Format | Public Suffix List | https://github.com/publicsuffix/list/wiki/Format | - | 2026-11-23 | BD-001、ADR-0004 | ルールの形式と判定 |
| REF-017 | Vue 3 Introduction | Vue.js | https://vuejs.org/guide/introduction.html | Vue 3 | 2026-11-23 | ADR-0002 | UI の構成 |
| REF-018 | Web accessible resources | Google | https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources | - | 2026-11-23 | BD-001 | ページへ公開される拡張機能リソース |
| REF-019 | Message passing | Google | https://developer.chrome.com/docs/extensions/develop/concepts/messaging | - | 2026-11-23 | BD-001 | コンテキスト間通信 |
| REF-020 | Storage API | Google | https://developer.chrome.com/docs/extensions/reference/api/storage | - | 2026-11-23 | ADR-0003 | chrome.storage の制限 |
| REF-021 | Windows API | Google | https://developer.chrome.com/docs/extensions/reference/api/windows | - | 2026-11-23 | BD-001 | 独立したウィンドウの作成・管理 |
| REF-022 | Commands API | Google | https://developer.chrome.com/docs/extensions/reference/api/commands | - | 2026-11-23 | BD-001 | キーボードショートカット |
