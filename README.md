# Discord Gamble Bot

Discord Bot でポイントを賭けるゲームを楽しめるサービスです。Web 管理画面でゲームの作成・管理を行い、Discord 上でユーザーが賭けに参加します。

## 構成

| サービス | 技術 | 役割 |
|---------|------|------|
| **Web API** | Express.js (TypeScript) | ゲーム・ユーザー管理の API サーバー |
| **Discord Bot** | discord.js (TypeScript) | 賭けコマンド・通知のインターフェース |
| **Web アプリ** | React + Vite (TypeScript) | ゲーム管理・状況表示の Web UI |
| **DB** | PostgreSQL 16 | データの永続化 |
| **nginx** | nginx 1.25 | リバースプロキシ / SSL 終端 |

## 主な機能

- イベント（ゲームのまとまり）の作成・管理
- 賭けゲームの作成・公開・締め切り・結果設定
- ポイント制の賭けシステム（パリミュチュエル方式のオッズ計算）
- 借金機能（手持ちポイント以上の賭けが可能）
- Discord OAuth2 による認証（ギルドメンバー判定・管理者ロール判定）
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
| `ADMIN_TOKEN` | Bot → Server 通信の認証トークン（推測困難なランダム文字列）|
| `DISCORD_TOKEN` | Discord Bot トークン |
| `DISCORD_CLIENT_ID` | Discord アプリケーション ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth2 クライアントシークレット |
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
| `nginx` | リバースプロキシ | `80`, `443` |

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
| Web アプリ（React） | GitHub Pages | `https://reisun.github.io/discord_gamble_bot/` |
| Web API（Express） | 自宅 Docker + nginx | `https://reisun.asuscomm.com/api` |

### 手順

#### 1. SSL 証明書の配置

```bash
cd docker/nginx/certs
cat cert.pem cert.crt > fullchain.pem
cp key.pem key.pem
```

> `docker/nginx/certs/` は `.gitignore` に含まれているためコミットされない。

#### 2. `.env` の設定

```env
CORS_ALLOWED_ORIGINS=https://reisun.github.io,https://reisun.asuscomm.com
WEB_APP_BASE_URL=https://reisun.github.io/discord_gamble_bot/
```

#### 3. Discord Developer Portal の設定

- OAuth2 Redirects に `https://reisun.asuscomm.com/api/auth/discord/callback` を追加

#### 4. Windows ファイアウォール

PowerShell（管理者）で実行：

```powershell
New-NetFirewallRule -DisplayName "Docker nginx HTTP"  -Direction Inbound -Protocol TCP -LocalPort 80  -Action Allow
New-NetFirewallRule -DisplayName "Docker nginx HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

#### 5. ルーターのポート転送

| 外部ポート | 内部ポート |
|---|---|
| 80 | 80 |
| 443 | 443 |

#### 6. GitHub リポジトリの設定

**Settings > Environments > `github-pages` > Variables**:

| Name | Value |
|---|---|
| `API_BASE_URL` | `https://reisun.asuscomm.com/api` |

**Settings > Pages** で Source を **GitHub Actions** に設定。

#### 7. Docker の起動

```bash
docker compose up -d --build
```

本番で起動するサービス：

| サービス | 外部公開 |
|---------|---------|
| `db` | なし（127.0.0.1 のみ）|
| `server` | なし（nginx 経由）|
| `bot` | なし（アウトバウンドのみ）|
| `nginx` | 80, 443 |

> `web` コンテナは GitHub Pages が代替するため本番では不使用。

#### 8. 疎通確認

```bash
curl https://reisun.asuscomm.com/api/health
# → {"status":"ok"}
```

Web アプリ: https://reisun.github.io/discord_gamble_bot/

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
