# プライバシーポリシー

本サービスは、[Discord Developer Terms of Service](https://discord.com/developers/docs/policies-and-agreements/developer-terms-of-service) および [Discord Developer Policy](https://discord.com/developers/docs/policies-and-agreements/developer-policy) を尊重し、以下のように定めます。

## 1. 取得する情報

本サービスは、Discord との連携を通じて以下の情報を取得します。

### ユーザー情報

- Discord ユーザーID
- サーバー内表示名
- アバター画像URL

Bot の /bet コマンド使用時に取得されます。

### サーバー情報

- サーバーID
- サーバー名
- サーバーアイコン

Bot がサーバーに参加した際に取得されます。

## 2. 用途

取得した情報は、以下の目的にのみ使用します。

- ランキングなどの賭けたユーザーの賭け状況の表示（表示名・アバター）
- サーバーごとのイベント管理とダッシュボード表示（サーバー情報）

取得した情報を第三者に提供・販売することはありません。

## 3. 禁止用途

取得した情報について、以下の行為は一切行いません。

- AI・機械学習モデルのトレーニングへの使用
- 広告ネットワークやデータブローカーへの提供
- ユーザー情報の販売・ライセンス供与・商業利用
- 匿名化されたデータの再識別

## 4. 保存期間と削除

取得した情報は、本サービスのサーバーに以下の期間、保存されます。

| 対象 | 保存期間 | 削除方法 |
|------|---------|---------|
| ユーザー情報 | 登録から2週間 | Discord ID は匿名化、表示名・アバターURL は削除 |
| サーバー情報 | 無制限 | - |

削除処理はサーバー起動時および24時間ごとに自動実行されます。

## 5. データ削除リクエスト

自動削除を待たずにユーザー情報の即時削除を希望する場合は、以下の GitHub Issues から削除リクエストを送信してください。

**[データ削除リクエスト](https://github.com/reisun/discord-gamble-bot/issues)**

リクエストには Discord ユーザーIDまたは表示名を記載してください。
（個人開発・運用のため、対応までお時間をいただく場合があります。）

## 6. お問い合わせ

本ポリシーに関するご質問やお問い合わせは、GitHub Issues で受け付けています。

**[お問い合わせ](https://github.com/reisun/discord-gamble-bot/issues)**
