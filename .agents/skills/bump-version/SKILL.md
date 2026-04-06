---
name: bump-version
description: 承認済み変更に対して、対象コンポーネントのバージョンと関連文書を更新するときに使う
disable-model-invocation: true
---

対象: $ARGUMENTS

手順:
1. 対象コンポーネントを特定する
   - web-app
   - web-api
   - bot
2. review-change の結果、または明示指示から更新要否と推奨種別を確認する
3. patch / minor / major のどれで上げるか確定する
4. 対象の version ファイルを更新する
5. 必要なら changelog、release note、関連文書を更新する
6. バージョン更新に伴う参照箇所を確認する
   - package.json
   - app metadata
   - API version 表記
   - Bot version
   - ドキュメント
7. 更新結果を要約する

ルール:
- 承認前の変更には使わない
- 推奨種別と異なる更新を行う場合は理由を書く
- 対象が web-app / web-api / bot のどれかを明示する
- version 更新と無関係なコード変更は混ぜない

出力:
- 対象コンポーネント
- 旧バージョン
- 新バージョン
- 更新種別
- 更新理由
- 更新ファイル
- 関連文書更新の有無
- 注意点