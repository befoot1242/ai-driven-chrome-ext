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
| REF-023 | tldts | tldts contributors | https://github.com/remusao/tldts | - | 2026-11-23 | BD-001、ADR-0004 | 共有サービスを含む PSL 判定と URL 正規化 |
| REF-024 | Public Suffix List data | Public Suffix List | https://publicsuffix.org/list/public_suffix_list.dat | - | 2026-11-23 | ADR-0004 | PSL の元データのライセンス |
| REF-025 | tldts license | tldts contributors | https://github.com/remusao/tldts/blob/master/LICENSE | - | 2026-11-23 | ADR-0004 | tldts 本体のライセンス |
| REF-026 | Chrome DevTools Performance | Google | https://developer.chrome.com/docs/devtools/performance | Chrome 129 の説明 | 2026-11-23 | BD-001 | Chrome の性能記録・分析 |
| REF-027 | vue package metadata | npm | https://registry.npmjs.org/vue/3.5.46 | 3.5.46 | 2026-11-23 | ADR-0002 | バージョン・ライセンス・依存関係 |
| REF-028 | tldts package metadata | npm | https://registry.npmjs.org/tldts/7.5.5 | 7.5.5 | 2026-11-23 | ADR-0004 | バージョン・ライセンス・依存関係 |
| REF-029 | tldts-core package metadata | npm | https://registry.npmjs.org/tldts-core/7.5.5 | 7.5.5 | 2026-11-23 | ADR-0004 | 依存パッケージのライセンス |
| REF-030 | IDBTransaction | MDN | https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction | - | 2026-11-23 | DD-task-001 | トランザクションの順序と有効期間 |
| REF-031 | Runtime API | Google | https://developer.chrome.com/docs/extensions/reference/api/runtime | - | 2026-11-23 | DD-capture-001 | メッセージ送信元情報の取得 |
| REF-032 | Temporal.ZonedDateTime.from() | MDN | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/ZonedDateTime/from | - | 2026-11-23 | DD-task-001 | 現地日時の欠落・重複時の変換と範囲外入力の扱い |
| REF-033 | Temporal.Now.timeZoneId() | MDN | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/Now/timeZoneId | - | 2026-11-23 | DD-task-001 | 端末のタイムゾーン識別子の取得 |
| REF-034 | New in Chrome 144 | Google | https://developer.chrome.com/blog/new-in-chrome-144 | Chrome 144 | 2026-11-23 | DD-task-001 | Chrome における Temporal API の導入 |
| REF-035 | Action API | Google | https://developer.chrome.com/docs/extensions/reference/api/action | - | 2026-11-23 | DD-reminder-001、DD-capture-001 | アイコン・popup・バッジの動作 |
| REF-036 | IndexedDB upgradeneeded event | MDN | https://developer.mozilla.org/en-US/docs/Web/API/IDBOpenDBRequest/upgradeneeded_event | - | 2026-11-23 | DD-task-001 | スキーマの版更新 |
| REF-037 | IndexedDB versionchange event | MDN | https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/versionchange_event | - | 2026-11-23 | DD-task-001 | 他の接続への版更新通知 |
| REF-038 | IndexedDB transaction abort | MDN | https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/abort | - | 2026-11-23 | DD-task-001 | トランザクション中止と変更の巻き戻し |
| REF-039 | IndexedDB blocked event | MDN | https://developer.mozilla.org/en-US/docs/Web/API/IDBOpenDBRequest/blocked_event | - | 2026-11-23 | DD-task-001 | 他の接続による版更新の待機 |
| REF-040 | Chrome DevTools Performance timeline reference | Google | https://developer.chrome.com/docs/devtools/performance/timeline-reference | - | 2026-11-23 | DD-reminder-001 | 描画・イベントのトレース |
| REF-041 | tldts package license | npm / UNPKG | https://unpkg.com/tldts@7.5.5/LICENSE | 7.5.5 | 2026-11-23 | DD-reminder-001 | 配布パッケージのライセンスファイル |
| REF-042 | tldts-core package license | npm / UNPKG | https://unpkg.com/tldts-core@7.5.5/LICENSE | 7.5.5 | 2026-11-23 | DD-reminder-001 | 依存パッケージのライセンスファイル |
| REF-043 | tldts package contents | npm / UNPKG | https://unpkg.com/tldts@7.5.5/?meta | 7.5.5 | 2026-11-23 | DD-reminder-001 | 配布パッケージのファイル一覧 |
| REF-044 | Vue package license | npm / UNPKG | https://unpkg.com/vue@3.5.46/LICENSE | 3.5.46 | 2026-11-23 | DD-task-002 | 配布パッケージのライセンスファイル |
| REF-045 | URL.createObjectURL() | MDN | https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static | - | 2026-11-23 | DD-task-002 | 画像表示用 URL の作成と Worker の制限 |
| REF-046 | URL.revokeObjectURL() | MDN | https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static | - | 2026-11-23 | DD-task-002 | 画像表示用 URL の解放 |
| REF-047 | Extension service worker lifecycle | Google | https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle | - | 2026-11-23 | DD-reminder-001 | Worker の停止と状態の永続化 |
| REF-048 | End-to-end testing | Google | https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing | - | 2026-11-23 | DD-reminder-001 | 拡張機能と Worker 停止の試験環境 |
| REF-049 | Test service worker termination | Google | https://developer.chrome.com/docs/extensions/how-to/test/test-serviceworker-termination-with-puppeteer | - | 2026-11-23 | DD-reminder-001 | Worker 終了テストの例 |
| REF-050 | MutationObserver | MDN | https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver | - | 2026-11-23 | DD-capture-001 | DOM ツリー変更の監視対象 |
| REF-051 | Same-origin policy | MDN | https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy | - | 2026-11-23 | DD-capture-001、DD-communication-001 | 異なるオリジンと保存領域の境界 |
| REF-052 | requestAnimationFrame | MDN | https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame | - | 2026-11-23 | DD-reminder-001 | コールバックと再描画の順序 |
| REF-053 | DevTools Performance reference | Google | https://developer.chrome.com/docs/devtools/performance/reference | - | 2026-11-23 | DD-reminder-001 | トレースとスクリーンショット |
| REF-054 | Performance.timeOrigin | MDN | https://developer.mozilla.org/en-US/docs/Web/API/Performance/timeOrigin | - | 2026-11-23 | DD-reminder-001 | 異なるコンテキストの時間原点 |
| REF-055 | tldts data update source | tldts contributors | https://github.com/remusao/tldts/blob/30f32825e9b587489b21e0ac70370c59ee3f6412/packages/tldts-utils/src/update.ts | commit 30f3282 | 2026-11-23 | DD-reminder-001 | PSL から trie を生成する処理 |
| REF-056 | tldts PSL loader source | tldts contributors | https://github.com/remusao/tldts/blob/30f32825e9b587489b21e0ac70370c59ee3f6412/packages/tldts-utils/src/list.ts | commit 30f3282 | 2026-11-23 | DD-reminder-001 | PSL ファイルの読み込み |
| REF-057 | tldts source tree | tldts contributors | https://api.github.com/repos/remusao/tldts/git/trees/30f32825e9b587489b21e0ac70370c59ee3f6412 | commit 30f3282 | 2026-11-23 | DD-reminder-001 | PSL サブモジュールの識別 |
| REF-058 | Mozilla Public License | Mozilla | https://www.mozilla.org/en-US/MPL/2.0/ | 2.0 | 2026-11-23 | DD-reminder-001 | 配布時の条件 |
| REF-059 | tldts generated trie source | tldts contributors | https://raw.githubusercontent.com/remusao/tldts/30f32825e9b587489b21e0ac70370c59ee3f6412/packages/tldts/src/data/trie.ts | commit 30f3282 | 2026-11-23 | DD-reminder-001 | 候補コミット内の生成データ |
| REF-060 | tldts packaged trie source | npm / UNPKG | https://unpkg.com/tldts@7.5.5/src/data/trie.ts | 7.5.5 | 2026-11-23 | DD-reminder-001 | 配布パッケージ内の生成データ |
