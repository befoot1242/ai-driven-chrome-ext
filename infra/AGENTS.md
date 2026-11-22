# infra/AGENTS.md

`infra/` 配下で作業するときは、ルートの `AGENTS.md` に加えてこのファイルに従う。

## 前提

- Chrome 拡張単体ではインフラは不要。バックエンド（API、データ保存など）が基本設計で必要と決まった場合にのみ使う。
- IaC は AWS CDK（TypeScript）。ルールは `.github/instructions/iac.instructions.md`。

## 構成

```
infra/
├─ modules/          # 再利用する Construct
└─ envs/
   ├─ dev/           # 開発（AI が変更してよい）
   ├─ stg/           # 検証（変更は提案のみ）
   └─ prod/          # 本番（AI は変更しない）
```

## 禁止事項

- `envs/prod/` のファイルを変更すること（差分の提案のみ可）
- `cdk deploy` / `cdk destroy` / `terraform apply` 等、実環境に反映するコマンドを実行すること（`cdk synth` / `cdk diff` は可）
- アクセスキー、シークレット、アカウント ID をファイルに書くこと
- データを持つリソースの `removalPolicy` を `DESTROY` にすること
