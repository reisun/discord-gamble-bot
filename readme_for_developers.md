## 開発環境構築

### dockerの起動
    docker-compose up -d --build

### dockerコンテナに入る
    docker exec -it discord_spla_bot sh

### 環境変数の設定
discordのトークンやMongoDBの接続先は環境変数で読み込まれます。開発用には以下のように`.env`を作成してください。

1. テンプレートをコピー
    cp src/SPLABOT/.env.example src/SPLABOT/.env
2. `src/SPLABOT/.env`の中身を編集
    * `DISCORD_TOKEN` : DiscordのBOTトークン
    * `ALLOWED_SERVERS` : コマンドを受け付けるサーバーIDをカンマ区切りで指定
    * `MONGODB_URI` : MongoDBへの接続URI

### node_modulesのインストール
    cd /home/SPLABOT
    npm i

### typescriptのビルド
    npm run compile

### botの起動
    npm run start

