# Discord Gamble Bot

Discord Bot でポイントを賭けるゲームを楽しめるサービスです。Web 管理画面でゲームの作成・管理を行い、Discord 上でユーザーが賭けに参加します。

## 構成

| サービス | 技術 | 役割 |
|---------|------|------|
| **Web API** | Express.js (TypeScript) | ゲーム・ユーザー管理の API サーバー |
| **Discord Bot** | discord.js (TypeScript) | 賭けコマンド・通知のインターフェース |
| **Web アプリ** | React + Vite (TypeScript) | ゲーム管理・状況表示の Web UI |
| **DB** | PostgreSQL 16 | データの永続化 |
| **nginx** | nginx 1.25 | 内部リバースプロキシ（:80 HTTP）/ 親 reverse-proxy 経由で外部公開 |

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
| `web` | React/Vite 開発サーバー | `127.0.0.1:5173` |
| `bot` | Discord Bot | - |
| `nginx` | 内部リバースプロキシ（HTTP :80） | なし（親 reverse-proxy 経由） |

> サーバーは起動時にマイグレーションを自動実行します。

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

### 構成

| コンポーネント | ホスト | URL |
|---|---|---|
| Web アプリ（React） | GitHub Pages | `https://reisun.github.io/discord-gamble-bot/` |
| Web API（Express） | 自宅 Docker（親 reverse-proxy 経由） | `https://your-domain.example.com/discord-gamble-bot/api` |

> TLS 終端・ドメイン設定・ポート 80/443 公開は **親 reverse-proxy**（[`workspace/reverse-proxy`](https://github.com/reisun/reverse-proxy)）が担う。本リポジトリは `:80` HTTP のみ共有ネットワーク `discord-gamble-bot-net` 経由で公開する。詳細は [`docs/infra/reverse-proxy-assumption.md`](./docs/infra/reverse-proxy-assumption.md)。

### 手順

#### 1. 親 reverse-proxy を先にセットアップ

親 reverse-proxy 側で以下を行う（本 repo には不要）:

- TLS 証明書配置（`fullchain.pem` / `key.pem`）
- Windows ファイアウォール / ルーターポート転送（80, 443）
- `nginx.conf` に `/discord-gamble-bot/` upstream 追加
- `docker-compose.yml` に `discord-gamble-bot-net` を external 参加

#### 2. `.env` の設定

```env
CORS_ALLOWED_ORIGINS=https://reisun.github.io,https://your-domain.example.com
WEB_APP_BASE_URL=https://reisun.github.io/discord-gamble-bot/
```

#### 3. GitHub リポジトリの設定

**Settings > Environments > `github-pages` > Variables**:

| Name | Value |
|---|---|
| `API_BASE_URL` | `https://your-domain.example.com/discord-gamble-bot/api` |

**Settings > Pages** で Source を **GitHub Actions** に設定。

#### 4. Docker の起動

```bash
docker compose up -d --build
```

本番で起動するサービス：

| サービス | 外部公開 |
|---------|---------|
| `db` | なし（127.0.0.1 のみ）|
| `server` | なし（nginx 経由）|
| `bot` | なし（アウトバウンドのみ）|
| `nginx` | なし（親 reverse-proxy 経由、共有ネット `discord-gamble-bot-net`） |

> `web` コンテナは GitHub Pages が代替するため本番では不使用。

#### 5. 親 reverse-proxy 側の起動 / リロード

親 reverse-proxy を起動 or 設定変更後にリロードする（本 repo が先に起動してネットワークを作成した状態で）。

#### 6. 疎通確認

```bash
# 親 reverse-proxy 経由
curl https://your-domain.example.com/discord-gamble-bot/api/health
# → {"status":"ok"}

# 本 repo 単体（親 reverse-proxy が同一ホストで動作中なら）
docker compose exec nginx wget -qO- http://localhost/health
# → ok
```

Web アプリ: https://reisun.github.io/discord-gamble-bot/

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
