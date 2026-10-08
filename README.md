# Discord Gamble Bot

Discord Bot でポイントを賭けるゲームを楽しめるサービスです。Web 管理画面でゲームの作成・管理を行い、Discord 上でユーザーが賭けに参加します。

## 構成

| サービス | 技術 | 役割 |
|---------|------|------|
| **Web API** | Express.js (TypeScript) | ゲーム・ユーザー管理の API サーバー |
| **Discord Bot** | discord.js (TypeScript) | 賭けコマンド・通知のインターフェース |
| **Web アプリ** | React + Vite (TypeScript) | ゲーム管理・状況表示の Web UI |
| **DB** | PostgreSQL 16 | データの永続化 |

## 主な機能

- イベント（ゲームのまとまり）の作成・管理
- 賭けゲームの作成・公開・締め切り・結果設定
- ポイント制の賭けシステム（パリミュチュエル方式のオッズ計算）
- 借金機能（手持ちポイント以上の賭けが可能）
- ユーザー情報の自動削除（登録から2週間後）

---

## 開発環境構築

### 前提条件

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (WSL2 バックエンド)
- Node.js 20 以上（テスト・lint をホスト上で実行する場合のみ必要）

### 環境変数の設定

```bash
cp .env.example .env
```

`.env` を開き、各項目を設定する。最低限必要なのは以下：

| 変数 | 説明 |
|------|------|
| `POSTGRES_PASSWORD` | PostgreSQL のパスワード（任意の文字列）|
| `DATABASE_URL` | `postgresql://<USER>:<PASSWORD>@db:5432/<DB>` 形式 |
| `DISCORD_TOKEN` | Discord Bot トークン |
| `DISCORD_CLIENT_ID` | Discord アプリケーション ID |
| `DISCORD_GUILD_ID` | Bot を追加するサーバーの ID（複数はカンマ区切り）|
| `DISCORD_ADMIN_ROLE_ID` | 管理者ロールの ID（複数はカンマ区切り）|

### Docker の起動

```bash
docker compose up -d --build
```

再デプロイ時の判断基準:

| 状況 | コマンド |
|------|---------|
| コードを変えた | `docker compose up -d --build` |
| 設定だけ変えた | `docker compose up -d --force-recreate` |
| 特定サービスだけ | `docker compose up -d --build <service>` |

起動するサービス：

| サービス | 用途 | ホスト側ポート |
|---------|------|--------------|
| `db` | PostgreSQL 16 | `127.0.0.1:5432` |
| `server` | Express.js API サーバー | `127.0.0.1:3000` |
| `web-dev-server` | React/Vite 開発サーバー | `127.0.0.1:5173` |
| `bot` | Discord Bot | - |

> サーバーは起動時にマイグレーションを自動実行します。

Bot の接続先は `BOT_API_BASE_URL=http://server:3002` が既定です。旧 `API_BASE_URL` は使用しません。内部ポート 3002 は Compose ネットワーク内だけで使用し、公開ポートや Quick Tunnel の接続先には指定しないでください。

> bot コンテナは起動時にスラッシュコマンドを Discord へ自動登録します。

### 動作確認

```bash
# API ヘルスチェック
curl http://127.0.0.1:3000/api/health
# → {"status":"ok"} が返れば OK

# Web アプリ
# ブラウザで http://127.0.0.1 を開く
```

---

## 本番デプロイ

### 構成と接続設定

Web アプリは GitHub Pages、API は Docker の `server:3000` を Cloudflare Quick Tunnel 経由で公開します。共有リバプロや共有 Docker ネットワークは不要です。公開リスナー（3000）には `/internal` を登録しません。Bot 専用リスナー（3002）は Docker 内部のみで使用し、ホスト側へ公開しません。

`.env` の `CORS_ALLOWED_ORIGINS` は `https://reisun.github.io`（Compose 既定値）、`WEB_APP_BASE_URL` は `https://reisun.github.io/discord-gamble-bot/` に設定します。

GitHub リポジトリ変数 `QUICK_TUNNEL_URL` に発行された HTTPS URL（例: `https://example-random.trycloudflare.com`）を設定し、`.github/workflows/deploy-pages.yml` を実行します。Pages の Source は GitHub Actions に設定します。ワークフローは `packages/web/public/config.json` に `{ "apiBaseUrl": "https://example-random.trycloudflare.com" }` を生成します。画面は起動前にこのファイルをキャッシュなしで取得し、API の `/api` を追加してアクセスします。URL 変更時は変数更新後に再デプロイします。生成ファイルと `.env` はコミットしません。

API・DB・Bot の起動、Quick Tunnel の開始、URL 取得、変数更新と Pages 再デプロイはワークスペースの `reverse-proxy/scripts/quick-tunnels.py` がまとめて行います。`web-dev-server` は開発用です。

疎通確認はトンネル URL の `/api/health`（JSON）で行います。ローカル開発では従来どおり Vite の `/api` プロキシを利用します。本番の設定が欠落・不正な場合はエラーを表示し、旧リバプロへ接続しません。

---

## テスト

テストは Docker の PostgreSQL コンテナが起動している状態で実行。

**初回のみ：** テスト専用 DB を作成する。

```bash
docker compose exec db psql -U <POSTGRES_USER> -d postgres -c "CREATE DATABASE gamble_bot_test;"
npm install
```

```bash
# Web API サーバー（統合テスト）
npm test -w @discord-gamble-bot/server

# Web アプリ（コンポーネントテスト）
npm test -w @discord-gamble-bot/web

# Discord Bot（単体テスト）
npm test -w @discord-gamble-bot/bot
```

---

## データベース操作

```bash
npm run migrate -w @discord-gamble-bot/server            # マイグレーション適用
npm run migrate:down -w @discord-gamble-bot/server       # 1つ戻す
npm run migrate:create -w @discord-gamble-bot/server -- --name <name>  # 新規作成
npm run seed -w @discord-gamble-bot/server               # 開発用サンプルデータ
```

## コード品質

```bash
npm run lint      # Lint チェック
npm run format    # Prettier フォーマット
```

## Docker 操作

```bash
docker compose stop               # 停止（ボリューム保持）
docker compose restart            # 再起動
docker compose logs -f server     # サーバーログ
docker compose logs -f bot        # Bot ログ
```

> `docker compose down -v` はボリューム（DB データ）が消えるため要確認。
