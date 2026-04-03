## 開発環境構築

### 前提条件

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (WSL2 バックエンド)
- Node.js 20 以上（テスト・lint をホスト上で実行する場合のみ必要）

---

### 環境変数の設定

```bash
cp .env.example .env
```

`.env` を開き、各項目を設定する。最低限必要なのは以下：

| 変数 | 説明 |
|------|------|
| `POSTGRES_PASSWORD` | PostgreSQL のパスワード（任意の文字列）|
| `DATABASE_URL` | `postgresql://<USER>:<PASSWORD>@db:5432/<DB>` 形式 |
| `ADMIN_TOKEN` | Web 管理画面の認証トークン（推測困難なランダム文字列）|
| `DISCORD_TOKEN` | Discord Bot トークン |
| `DISCORD_GUILD_ID` | Bot を追加するサーバーの ID（複数はカンマ区切り）|
| `DISCORD_ADMIN_ROLE_ID` | 管理者コマンドを使えるロールの ID |

---

### Docker の起動

```bash
docker compose up -d --build
```

起動するサービス：

| サービス | 用途 | ホスト側ポート |
|---------|------|--------------|
| `db` | PostgreSQL 16 | `127.0.0.1:5432` |
| `server` | Express.js API サーバー | `127.0.0.1:3000` |
| `web` | React/Vite 開発サーバー | `127.0.0.1:5173` |
| `bot` | Discord Bot | - |
| `nginx` | リバースプロキシ | `127.0.0.1:80` |

> サーバーは起動時にマイグレーションを自動実行します。

---

### 動作確認

#### Web アプリ

ブラウザで以下を開く：

```
http://127.0.0.1
```

管理者として開く場合は `?token=<ADMIN_TOKEN>` を URL に付与する：

```
http://127.0.0.1/#/events?token=<ADMIN_TOKEN>
```

#### Web API

```bash
# ヘルスチェック（{"status":"ok"} が返れば OK）
curl http://127.0.0.1:3000/api/health

# トークン検証（{"data":{"isAdmin":true}} が返れば OK）
curl "http://127.0.0.1:3000/api/auth/verify?token=<ADMIN_TOKEN>"
```

---

以上で動作確認完了。以降は開発・参照用の手順です。

---

### テスト実行

テストは Docker の PostgreSQL コンテナ（`127.0.0.1:5432`）が起動している状態で実行します。

**初回のみ：** テスト専用 DB を作成する。

```bash
docker compose exec db psql -U <POSTGRES_USER> -d postgres -c "CREATE DATABASE gamble_bot_test;"
```

ホスト上での `node_modules` インストール（未実施の場合）：

```bash
npm install
```

テスト実行：

```bash
# === Web API サーバー（統合テスト）===

# 全テスト実行（66 件）
npm test -w @discord-gamble-bot/server

# ウォッチモード
npm run test:watch -w @discord-gamble-bot/server

# カバレッジ付き
npm run test:coverage -w @discord-gamble-bot/server

# === Web アプリ（コンポーネントテスト）===
# Vitest + React Testing Library（Docker 不要、ホスト上のみで完結）

# 全テスト実行（44 件）
npm test -w @discord-gamble-bot/web

# ウォッチモード
npm run test:watch -w @discord-gamble-bot/web
```

### データベース操作（参考）

```bash
# マイグレーションを手動適用
npm run migrate -w @discord-gamble-bot/server

# 1 つ戻す
npm run migrate:down -w @discord-gamble-bot/server

# 新しいマイグレーションファイルを作成
npm run migrate:create -w @discord-gamble-bot/server -- --name <migration-name>

# シードデータの投入（開発用サンプルデータ）
npm run seed -w @discord-gamble-bot/server
```

---

### コード品質（参考）

```bash
npm run lint      # Lint チェック
npm run format    # Prettier によるフォーマット
```

---

### Docker の停止・ログ確認（参考）

```bash
docker compose stop               # 停止（ボリューム保持）
docker compose restart            # 再起動
docker compose logs -f server     # サーバーログ
docker compose logs -f bot        # Bot ログ
docker compose exec server sh     # コンテナに入る
```

> `docker compose down -v`（ボリューム削除）は DB データが消えるため要確認。
