# Discord Gamble Bot

Discord Bot でポイントを賭けるゲームを楽しめるサービスです。Web 管理画面でゲームの作成・管理を行い、Discord 上でユーザーが賭けに参加します。

## 構成

| サービス | 技術 | 役割 |
|---------|------|------|
| **Web API** | Express.js (TypeScript) | ゲーム・ユーザー管理の API サーバー |
| **Discord Bot** | discord.js (TypeScript) | 賭けコマンド・通知のインターフェース |
| **Web アプリ** | React + Vite (TypeScript) | ゲーム管理・状況表示の Web UI |
| **DB** | PostgreSQL 16 | データの永続化 |
| **nginx** | nginx 1.25 | 内部リバースプロキシ（:80 HTTP）。外部公開は上流プロキシに委譲 |

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

### 共有ネットワークの作成（初回のみ）

本プロジェクトは外部ネットワーク `discord-gamble-bot-net` に参加します（上流プロキシと共有する用途）。まだ存在しない場合は作成してください。

```bash
docker network ls | grep discord-gamble-bot-net \
  || docker network create discord-gamble-bot-net
```

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
| `nginx` | 内部リバースプロキシ（HTTP :80） | なし（上流プロキシ経由） |

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
| Web API（Express） | Docker（上流プロキシ経由で公開） | `https://<public-domain>/discord-gamble-bot/api` |

> TLS 終端・ドメイン設定・ポート 80/443 公開は **上流プロキシ**（本リポジトリの外）が担う。本リポジトリは `:80` HTTP のみ共有ネットワーク `discord-gamble-bot-net` 経由で提供する。契約仕様は [`docs/infra/upstream-proxy-contract.md`](./docs/infra/upstream-proxy-contract.md)。
>
> 上流プロキシの実装は利用者が選択できる（共用リバプロに相乗り／本プロジェクト専用リバプロを単独導入／マネージド LB など）。同一ワークスペース内の `reverse-proxy` プロジェクトに相乗りする構成も可能な選択肢のひとつ。

### 手順

#### 1. 上流プロキシを先にセットアップ

上流プロキシ側で以下を行う（本 repo には不要）:

- TLS 証明書配置 / 取得（Let's Encrypt 等）
- ホストファイアウォール / ルーターのポート転送（80, 443）
- プロキシ設定に `/discord-gamble-bot/` → `discord-gamble-bot-nginx:80` upstream を追加
- プロキシ側 `docker-compose.yml` に `discord-gamble-bot-net` を external 参加

#### 2. `.env` の設定

```env
CORS_ALLOWED_ORIGINS=https://reisun.github.io,https://<public-domain>
WEB_APP_BASE_URL=https://reisun.github.io/discord-gamble-bot/
```

#### 3. GitHub リポジトリの設定

**Settings > Environments > `github-pages` > Variables**:

| Name | Value |
|---|---|
| `API_BASE_URL` | `https://<public-domain>/discord-gamble-bot/api` |

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
| `nginx` | なし（上流プロキシ経由、共有ネット `discord-gamble-bot-net`） |

> `web` コンテナは GitHub Pages が代替するため本番では不使用。

#### 5. 上流プロキシ側の起動 / リロード

上流プロキシを起動 or 設定変更後にリロードする（本 repo が先に起動してネットワークを作成した状態で）。

#### 6. 疎通確認

```bash
# 上流プロキシ経由
curl https://<public-domain>/discord-gamble-bot/api/health
# → {"status":"ok"}

# 本 repo 単体（上流プロキシが同一ホストで動作中なら）
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
