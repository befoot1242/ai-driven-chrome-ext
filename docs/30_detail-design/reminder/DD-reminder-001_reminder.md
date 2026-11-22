---
id: DD-reminder-001
title: 対象ドメインのリマインド
status: draft
trace: [BD-001]
owner: ""
updated: 2026-11-23
---

# DD-reminder-001 対象ドメインのリマインド

## 1. 概要

BD-001、FR-004、NFR-PERF-001、NFR-SEC-001 に対応し、通常の HTTP・HTTPS ページの読み込み・再読み込み・URL が変わるページ内遷移を契機に、対象ドメインの未完了タスクを独立した拡張機能画面に表示する。

タスク・停止設定の永続化と撮影処理は本書の対象外とする。本書の型とファイル配置は設計案であり、関連する詳細設計との整合確認は未了。

## 2. モジュール構成

| ファイル | 役割 |
|---|---|
| `src/background/navigation-listener.ts` | メインフレームのナビゲーションイベントを受け取る |
| `src/background/reminder-controller.ts` | 対象判定、画面の起動・更新・終了を調整する |
| `src/shared/domain.ts` | URL の正規化と対象ドメインの判定 |
| `src/background/reminder-session.ts` | タブとリマインド画面の対応を管理する |
| `src/reminder/` | 独立した拡張機能画面と利用者操作 |

上記は実装予定の論理構成であり、ファイルはまだ作成しない。

## 3. インターフェース

```ts
interface NavigationEvent {
  tabId: number;
  documentId: string;
  url: string;
  kind: 'completed' | 'history' | 'fragment';
}

interface ReminderCandidate {
  id: string;
  hostname: string;
  completed: boolean;
  suppressedUntil: string | null;
}

interface DomainSuppression {
  hostname: string;
  suppressedUntil: string;
}

interface ReminderSession {
  tabId: number;
  documentId: string;
  lastUrl: string;
  generation: number;
  windowId: number | null;
  pendingToken: string | null;
}

type DomainKey =
  | { kind: 'domain'; value: string }
  | { kind: 'host'; value: string };

function getDomainKey(url: string): DomainKey;
function getDomainKeyFromHostname(hostname: string): DomainKey;
function selectReminderTasks(
  pageDomain: DomainKey,
  tasks: ReminderCandidate[],
  domainSuppressions: DomainSuppression[],
  now: Date,
): ReminderCandidate[];
```

- `getDomainKey` は HTTP・HTTPS 以外や不正な URL に対してエラーを返す。保存済みタスクと停止設定の基準ホストは `getDomainKeyFromHostname` で同じ判定規則を適用する。
- `suppressedUntil` は UTC の瞬間を表す文字列、`now` は判定時の瞬間とする。終了日時と判定時刻が等しい場合、停止期間は終了している。
- `domain` と `host` の種別も比較し、文字列が同じであっても異なる種別を同一視しない。
- 型は拡張機能内部の論理インターフェースであり、実際の保存データや Chrome メッセージの型は関連する詳細設計と整合させる。

## 4. 処理詳細

### 4.1 ドメインと停止期間

1. URL を標準の URL パーサーで正規化し、HTTP・HTTPS 以外は対象外とする。対象ドメインは正規化後のホストから算出する。
2. `localhost` と IP アドレスは `host` として完全一致で比較する。それ以外は PSL の共有サービスを含むルールを使用し、登録可能なドメインを取得できる場合は `domain`、取得できない場合は `host` で比較する（ADR-0004、REF-023）。
3. タスクとドメイン停止設定は、保存時の結果ではなく現在同梱する PSL で再判定する。タスクが未完了で、対象ドメインが一致し、タスク単位・ドメイン単位のいずれの停止期間中でもない場合に表示対象とする。
4. 同じ対象に複数のドメイン停止設定が該当する場合、最も遅い終了日時まで停止する。変更・解除時は、現在の判定で該当する設定すべてを対象にする。対象の選択と変更・解除は IndexedDB の同一 `readwrite` トランザクションで行い、無関係な設定を置き換えない（REF-030）。

### 4.2 ナビゲーション

1. `webNavigation` の `onCompleted`、`onHistoryStateUpdated`、`onReferenceFragmentUpdated` を受け取り、メインフレームのイベントだけを対象とする（REF-013）。読み込み・再読み込みは URL が同じでも対象とする。
2. 案として、メインフレームの `onCommitted` で `documentId` と URL を記録し、History API・フラグメントのイベントでは同一ドキュメントの直前の URL と比較してから記録を更新する。URL が変化した場合だけリマインドの対象とする。対応情報と直前 URL は `chrome.storage.session` に保持し、タブが閉じたら削除する。URL は個人情報を含む可能性があるため、ログ・ページ・content script に渡さず、セッション領域のアクセス範囲を拡張機能の信頼できるコンテキストに限定する（REF-020）。
3. 同じタブの処理には更新ごとの `generation` を付け、画面への反映前に保存済みの `documentId`・`generation` と現在のタブを照合する。古いドキュメントや世代の処理結果は表示しない。イベント順序、同時処理の排他、および session 読み書きと画面更新の間の競合防止は未検証。
4. 通常の HTTP・HTTPS ページについて対象タスクを再取得する。表示対象がある場合、元タブに対応する画面を表示または更新して前面に出す。表示対象がない場合、対応画面が開いていれば閉じる。

拡張機能の再読み込みなどで前回 URL が不明なまま History API のイベントを受け取った場合、イベント発生後の現在 URL を読み取るだけでは変更前の URL を復元できない。変更の有無を推測せず、判定不能として扱うための通知・復旧方法は未決。

### 4.3 画面と元タブ

1. 元タブごとにリマインド画面を１つまでとする。タブ・画面の対応は `chrome.storage.session` に保持し、Service Worker の再起動後は対応と実在するタブ・画面を照合する（REF-020、REF-021）。
2. 利用者が画面を閉じた場合、同じページのままでは再表示せず、次の対象遷移時に再判定する。元タブを閉じた場合は対応画面を閉じ、対応を削除する。
3. ブラウザ再起動や拡張機能更新等でセッションデータが消えた場合、以前のタブ識別情報を再利用しない。対応を確認できない画面は内容を表示せず閉じる。
4. 作成前にタブごとの一意な `pendingToken` を session に保存し、画面から token と送信元の識別情報を使って対応付けを要求する案とする。対応付けが確認できるまで画面はタスクを表示しない。
5. 画面作成と対応の保存の間に Service Worker が停止した場合の再接続、古い token の無効化、二重作成や孤立した画面を防ぐ具体的な手順は未決。複数の作成要求が同時に到着した場合を含め、実機で復元と競合を検証する。

### 4.4 情報の保護と測定

タスク内容・画像は拡張機能の画面と background で扱い、content script、ページの DOM、`window.postMessage` に渡さない。画面からの要求は送信元の拡張機能 ID・画面・対応タブを確認し、検証できない要求にはタスクを返さない（REF-009、REF-010、REF-019）。

BD-001 の測定条件に従い、Windows の確認時点の Chrome 最新版で、HTTP と HTTPS の読み込み・再読み込み・History API による URL 変更・フラグメント変更を各10回、計80回測定する。各回、対象タスクが描画されるまで3秒以内であることを確認する。開始と終了を同じ時間基準で記録するため Chrome のトレースを使う案とする（REF-026）。`webNavigation` のイベント時刻を拡張機能の `Date.now()` と直接比較しない（REF-013）。開始点・終了点の取得手順と時間基準の一致は未検証。

## 5. 状態遷移

| 状態 | 契機 | 次の状態 |
|---|---|---|
| 画面なし | 対象遷移で表示対象あり | 画面作成中 |
| 画面作成中 | 作成・対応付けが成功 | 表示中 |
| 表示中 | 対象遷移で表示対象あり | 同じ画面を更新して表示中 |
| 表示中 | 対象遷移で表示対象なし | 画面なし |
| 表示中 | 利用者が閉じる、または元タブが閉じる | 画面なし |
| 画面作成中 | 作成または対応付けに失敗 | エラーを記録し、復旧方法は未決 |

## 6. エラー処理

| エラー | 検知方法 | ユーザーへの表示 | ログ |
|---|---|---|---|
| 不正 URL・非対象ページ | URL の解析・スキーム判定 | 非対象ページではリマインドしない | 不正 URL はエラー種別のみ |
| タスク・停止設定の取得失敗 | 保存処理からのエラー | 取得失敗を通知する方法は未決 | エラー種別のみ |
| 画面作成・更新失敗 | Chrome API・画面通信のエラー | 表示失敗を通知する方法は未決 | エラー種別のみ |
| 対応付け・復元失敗 | session 読み書き・対応確認のエラー | 対応を確認できない画面は内容を表示せず閉じる | エラー種別のみ |
| 送信元不正 | 送信元の検証 | 要求を拒否する | エラー種別のみ |

失敗を「対象タスクなし」として扱わない。独立画面が開けない場合を含む失敗通知の手段は未決。

## 7. ログ出力

エラー種別のみを記録し、URL・ホスト・タスク名・詳細・画像・停止設定を出力しない。テストには実データでなく検証用データを使用する。

## 8. テスト観点

- 正常系: 新規読み込み、再読み込み、History API・フラグメントによる URL 変更と、同一タブでの画面更新。
- 正常系: サブドメイン、`example.co.jp` と `other.co.jp`、共有サービスの別利用者、`localhost` と IP の判定。
- 正常系: 完了、タスク単位・ドメイン単位の停止、停止終了時刻、重複した停止設定の変更・解除。
- 正常系: 画面を閉じた後の次の遷移、元タブの終了、Service Worker 再起動後の対応復元。
- 異常系: 対象取得失敗、画面作成失敗、未認可の送信元、古いドキュメントの結果、画面作成途中の中断。
- 境界値: 停止終了日時の直前・同時・直後、URL が変わらない History API 操作。
- 非機能: BD-001 の80回の性能測定、ページ DOM・メッセージ・ネットワーク通信へのタスク情報露出防止。

## 9. 未決事項

- 初回状態が不明な場合の URL 変更判定不能の通知・復旧方法。
- ナビゲーション・画面作成の競合防止、Service Worker 中断時の二重作成・孤立画面の復旧。
- ドメイン停止設定の同時変更・解除時の完了順と表示内容の実機検証。
- 画面を開けない場合を含む、利用者への失敗通知方法。
- メッセージ型と送信元検証の詳細、関連する詳細設計との整合。
- 計測開始・終了点と共通の時間基準の取得方法、実機での3秒以内の検証。

## 変更履歴

| 日付 | 変更者 | 内容 |
|---|---|---|
| 2026-11-23 | AI | 初版案 |
| 2026-11-23 | AI | ドメイン停止設定の並行更新対策を追加 |
| 2026-11-23 | AI | session を用いた遷移世代・画面起動の競合対策案を追加 |
