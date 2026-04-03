# `/link` - WebアプリのURLを表示する

## 説明
一般ユーザーが Web アプリにアクセスするための URL（トークンなし）を表示する。

## オプション
なし

## 処理フロー

1. 実行されたサーバーの guildId を取得
2. 環境変数から WebアプリのベースURLを取得
3. guildId を含むホーム画面の URL を生成して返信（Ephemeral）

## 応答メッセージ（Ephemeral）

```
🔗 WebアプリのURLです。

https://<github-pages-url>/#/events/<guildId>
```

## エラー条件

| 条件 | 応答 |
|------|------|
| DM（サーバー外）から実行 | 「このコマンドはサーバー内でのみ使用できます。」（Ephemeral） |
