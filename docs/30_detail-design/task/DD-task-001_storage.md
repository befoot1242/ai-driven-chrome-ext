---
id: DD-task-001
title: タスクと画像の端末内保存
status: draft
trace: [BD-001]
owner: ""
updated: 2026-11-23
---

# DD-task-001 タスクと画像の端末内保存

## 1. 概要

BD-001、FR-002、FR-003、FR-004、NFR-AVL-001、NFR-AVL-002 に対応し、タスク・画像・リマインド停止設定・編集途中の一時データと撮影の一時結果を拡張機能オリジンの IndexedDB に保存する。リマインドの表示判定、撮影、画面操作およびコンテキスト間の通信は本書の対象外とする。

画面からのタスク保存は、画像の追加・削除・差し替えを含めて確定する。編集途中の一時保存は登録済みタスクを更新しない。

## 2. モジュール構成

以下は実装予定の論理構成であり、ファイルはまだ作成しない。

| ファイル | 役割 |
|---|---|
| `src/shared/task-types.ts` | タスク、画像、停止設定、一時データの型 |
| `src/background/task-repository.ts` | IndexedDB の読み書き、トランザクション、入力検証 |
| `src/background/task-capacity.ts` | 検証用の論理データ容量の計算 |

IndexedDB は拡張機能オリジンで使用する。content script のページオリジンの保存領域にはタスクや画像を保存しない（REF-014）。

## 3. インターフェース

```ts
type TaskId = string;
type ImageId = string;
type DraftId = string;

interface TaskRecord {
  id: TaskId;
  url: string;
  hostname: string;
  name: string;
  dueDate: string | null;
  detail: string;
  completed: boolean;
  createdAt: string;
  reminderSuppressedUntil: string | null;
  revision: number;
}

interface ImageRecord {
  id: ImageId;
  taskId: TaskId;
  position: number;
  data: Blob;
}

interface DomainSuppressionRecord {
  hostname: string;
  suppressedUntil: string;
}

interface EditDraft {
  id: DraftId;
  taskId: TaskId;
  baseRevision: number;
  task: TaskRecord;
  images: ImageRecord[];
}

interface CaptureTemporaryRecord {
  requestId: string;
  owner: { kind: 'registration' | 'edit'; id: string };
  status: 'pending' | 'ready' | 'error';
  imageId: ImageId | null;
  image: Blob | null;
  errorCode: string | null;
  restorationFailed: boolean;
}

interface TaskRepository {
  getTask(id: TaskId): Promise<{ task: TaskRecord; images: ImageRecord[] } | null>;
  listTasks(): Promise<TaskRecord[]>;
  saveTask(task: TaskRecord, images: ImageRecord[], expectedRevision: number | null): Promise<TaskRecord>;
  deleteTask(id: TaskId, expectedRevision: number): Promise<void>;
  saveDraft(draft: EditDraft): Promise<void>;
  getDraft(id: DraftId): Promise<EditDraft | null>;
  discardDraft(id: DraftId): Promise<void>;
  commitDraft(id: DraftId): Promise<TaskRecord>;
  listDomainSuppressions(): Promise<DomainSuppressionRecord[]>;
  updateDomainSuppression(hostname: string, suppressedUntil: string | null): Promise<void>;
}
```

- ID は各レコードを識別する文字列とし、異なるタスク・画像・一時データ間で重複させない。
- `dueDate` は期限なしの場合 `null`、期限ありの場合 `YYYY-MM-DD` 形式の日付とする。`createdAt` は登録日時、`revision` は保存時に更新する版番号とする。
- `url` は HTTP・HTTPS の URL、`hostname` はその URL から正規化して得たホストとする。呼び出し側の `hostname` を無条件に信用せず、保存前に URL から導出して整合させる。
- `createdAt`、`reminderSuppressedUntil`、`suppressedUntil` は UTC の ISO 8601 形式（`YYYY-MM-DDTHH:mm:ss.sssZ`）で保存する。停止終了日時は設定時の端末の現地日時から確定した瞬間に変換し、タイムゾーン変更後も同じ瞬間を維持する。表示時は現在の端末の現地日時に変換する。
- 夏時間等により存在しない現地日時は再入力を求める。同じ現地日時が２回ある場合は、利用者に UTC オフセットを示してどちらの瞬間か選択してもらい、確定した瞬間を保存する。
- 画像は１タスクにつき10件まで、１件につき5,000,000バイトまでとする。`position` はタスク内の表示順とする。
- 新規登録時の `expectedRevision` は `null` とし、保存済みの同一 ID がないことを確認して `revision` を1とする。既存タスクの変更時は読み込み時の `revision` を指定し、一致すれば1増加する。実際の版が一致しない場合は変更を拒否する。既存タスクの `createdAt` は変更しない。
- `updateDomainSuppression` は対象ホストと、変更後の停止終了日時または解除を表す `null` を受け取る。
- これらは拡張機能内部の論理インターフェースであり、Chrome メッセージのペイロード型ではない。`Blob` を Chrome メッセージに直接渡す設計ではない。

## 4. 処理詳細

1. IndexedDB に `tasks`、`images`、`domain_suppressions`、`edit_drafts`、`capture_temp` の各ストアを作成する。各ストアのキーはそれぞれタスク ID、画像 ID、正規化ホスト、一時データ ID、撮影要求 ID とする。`images` はタスク ID、`capture_temp` は所有者の種別と ID で取得できる索引を持つ。
2. タスクの確定前にタスク名の必須、URL、期限の形式と実在日付、画像の所有タスク・件数・サイズ・ID・表示順の整合性を検証する。画像の表示順は0から始まる連番とする。検証に失敗した場合、確定の書き込みは行わない。編集途中の一時保存では未入力のタスク名を許容し、画像の所有タスク・件数・サイズ・ID・表示順の整合性を検証する。
3. タスクと画像の保存・削除は同一トランザクションで行う。変更時は現在の版を照合し、画像の削除・追加とタスクの更新をまとめて確定する。版が一致しない場合や書き込みに失敗した場合は全体を中止する。
4. 撮影前の編集内容は `edit_drafts` に一時保存する。一時保存が成功するまで撮影用タブを開かない。一時データには編集中のタスクと、追加・削除・差し替えを反映した画像一覧を含める。
5. 編集保存時は、一時データの `baseRevision` を照合し、タスク・画像の更新と一時データの削除を同一トランザクションで確定する。失敗時は既存タスクと一時データを保持する。取消時は一時データだけを削除する。
6. タスク削除時は対象タスクと画像を同一トランザクションで削除する。確認操作は呼び出し側が担当する。別の編集画面の一時データは削除せず、確定時に元タスクが存在しないことをエラーとして通知する。
7. ドメイン停止設定の変更・解除は `domain_suppressions` の `readwrite` トランザクション内で現在の全設定を読み、現在の PSL により基準ホストが同じ対象に属する設定を判定する。変更時は該当する全設定を更新し、該当がなければ指定ホストの設定を作成する。解除時は該当する全設定を削除し、ほかの設定は変更しない。同じストアへの書き込みはトランザクション単位で順序付けられるため、先に読み出した一覧で全設定を置き換えない（REF-030）。
8. IndexedDB のトランザクション中にネットワーク通信や別コンテキストへの応答を待たない。対象判定に必要なローカルの PSL データは操作前に準備し、読み書きが失敗した場合はトランザクションを中止する（REF-030）。

撮影した画像の一時結果は `capture_temp` に保持し、拡張機能画面から同じオリジンの保存領域を通じて取得する案とする（REF-014）。`pending` は未完了、`ready` は画像付きの成功結果、`error` は画像を含まない失敗結果とする。撮影と復元の両方に失敗した場合はエラー種別と `restorationFailed` の両方を保持する。編集時に画像の追加を確定する場合は、所有者を照合し、編集途中の画像一覧への移行と撮影結果の一時データ削除を同一トランザクションで行う。Chrome メッセージに `Blob` は含めない（REF-019）。一時結果の所有者認証・中断時の整理手順と、撮影側の詳細設計との整合は未決。

### 容量の確認

NFR-AVL-001 の検証では、各タスクの `TaskRecord` を上記のフィールド順に JSON 化した UTF-8 バイト数と、各画像の `id`・`taskId`・`position` をこの順に JSON 化した UTF-8 バイト数、各画像 Blob のバイト数を合計する。配列の区切り文字、IndexedDB の内部管理領域、一時データ、ドメイン停止設定は含めない。この値は検証のための論理容量であり、端末の実際のディスク使用量ではない。

画像を１タスク10件以下、１件5,000,000バイト以下にして複数タスクに登録し、不足分を ASCII 文字のタスク詳細で調整することで合計100,000,000バイトの検証データを用意する。保存後に全タスク・画像を読み出し、内容と容量を再確認する。検証開始時の保存領域は空とし、必要な空き容量を確保する。100,000,000バイトを超えたことだけを理由に保存を拒否しない。

## 5. 状態遷移

| 対象 | 遷移 | 条件 |
|---|---|---|
| タスク | 未登録 → 登録済み | 入力検証とトランザクションが成功 |
| タスク | 登録済み → 更新済み | 版が一致し、トランザクションが成功 |
| タスク | 登録済み → 削除済み | 利用者が確認し、トランザクションが成功 |
| 編集 | 編集中 → 一時保存済み | 撮影前の一時保存が成功 |
| 編集 | 一時保存済み → 確定 | 版が一致し、タスク・画像の更新と一時データ削除が成功 |
| 編集 | 一時保存済み → 取消 | 一時データの削除が成功 |
| 編集 | 一時保存済み → 一時保存済み | 保存に失敗、または版が不一致 |

## 6. エラー処理

| エラー | 検知方法 | ユーザーへの表示 | ログ |
|---|---|---|---|
| 入力不正・画像上限超過 | 保存前の検証 | 対象項目と理由を表示 | エラー種別のみ |
| 版の不一致 | トランザクション内で版を照合 | 更新競合を表示し、入力を保持 | エラー種別のみ |
| 容量不足・書き込み失敗 | IndexedDB の要求またはトランザクションの失敗 | 保存できなかった理由を表示し、入力を保持 | エラー種別のみ |
| データの読み込み失敗 | IndexedDB の要求の失敗 | 読み込めなかったことを表示 | エラー種別のみ |
| 一時データの保存・削除失敗 | IndexedDB の要求またはトランザクションの失敗 | 操作が完了していないことを表示し、入力を保持 | エラー種別のみ |

保存や削除に失敗した場合、成功として扱わない。競合時の再読み込み・入力の統合操作は未決。

## 7. ログ出力

エラー種別のみを記録し、タスク名・詳細・URL・ホスト・画像・一時データを出力しない。正常な操作ではタスク内容や画像をログに出力しない。

## 8. テスト観点

- 正常系: 登録、編集、完了・未完了、画像の追加・削除・差し替え、確認後の削除、停止設定の保存、Chrome 再起動後の再表示。
- 正常系: 一時保存からの編集再開、確定時の一時データ削除、取消時に登録済みタスクが変化しないこと。
- 正常系: 撮影結果を拡張機能オリジンで受け取り、編集途中の画像への移行と一時結果の削除を同時に確定すること。
- 異常系: 保存途中の失敗時にタスクと画像が部分更新されないこと、撮影結果の移行失敗時に一時結果が保持されること、版の不一致、一時保存失敗、容量不足、読み込み失敗。
- 異常系: 同時にドメイン停止設定を変更・解除した場合に、無関係な設定や先行する変更が失われないこと。
- 日時: タイムゾーン変更後も停止終了の瞬間が変わらないこと、存在しない現地日時を拒否すること、重複する現地日時で選んだ瞬間を保存すること。
- 境界値: 画像10件と11件、5,000,000バイトと5,000,001バイト、合計100,000,000バイトの保存・再表示。
- セキュリティ: 入力内容や画像がログに含まれず、content script の保存領域に書き込まれないこと。

## 9. 未決事項

- 存在しない現地日時と重複する現地日時を検出する具体的な方法と選択画面。
- 同一ドメインに対する同時変更の完了順と表示内容を実機で検証すること。
- 編集競合時の画面操作と、一時データを復旧・破棄する操作。
- IndexedDB のバージョン管理・移行と、破損時の通知・復旧方法。
- 撮影結果の一時データの所有者認証・中断時の整理手順と、撮影側の詳細設計との整合。

## 変更履歴

| 日付 | 変更者 | 内容 |
|---|---|---|
| 2026-11-23 | AI | 初版案 |
| 2026-11-23 | AI | 停止終了日時のタイムゾーン変更・夏時間の扱いを追加 |
| 2026-11-23 | AI | ドメイン停止設定をトランザクション内で更新する案を追加 |
| 2026-11-23 | AI | 撮影結果の IndexedDB を介した受け渡し案を追加 |
| 2026-11-23 | AI | 撮影結果の一時ストアのキー・所有者・状態を追加 |
