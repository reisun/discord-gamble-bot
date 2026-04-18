# Upstream Proxy Contract — 本プロジェクトが上流プロキシに期待する仕様

## 立ち位置

本プロジェクト (`discord-gamble-bot`) は **HTTP のみで待ち受ける独立したアプリ**です。
TLS 終端やホストポート 80/443 の公開、公開ドメインの割当は本リポジトリの責務外で、上流に別途配置されるリバースプロキシへ委譲します。

**上流リバースプロキシの具体実装は本リポジトリでは定めません**（利用者の選択）:

- 複数サービスを束ねる共用リバプロに相乗りする（例: 同一ワークスペース内の `reverse-proxy` プロジェクト）
- 本プロジェクト専用の単独リバプロ（Traefik / Nginx / Caddy など）を個別に導入する
- クラウドのマネージドロードバランサや API Gateway に載せる

いずれも可。本ドキュメントは上流プロキシ側から本プロジェクトを取り込むための **契約（最小仕様）** を定義します。

## 本プロジェクトが扱う範囲

- 内部 `nginx` コンテナが `:80` で HTTP 受け（`/api` → Express、`/health` → 200 返却）。ホストポートへは bind しない
- 共有 Docker ネットワーク `discord-gamble-bot-net` 上で `nginx:80` として可用にする（`docker-compose.yml` は `external: true` 宣言。ネットワーク自体は **`docker network create discord-gamble-bot-net` で事前作成**する前提）
- `.env` の `CORS_ALLOWED_ORIGINS` に公開オリジンを設定

## 本プロジェクトが扱わない範囲

- TLS 証明書（Let's Encrypt 等）
- 公開ドメインの取得・DNS
- ホストポート 80/443 の公開
- ホストファイアウォール / ルーターのポート転送

## 想定される接続図

```
Internet
   │
   ▼ 443
[ Router / Public Domain ]
   │
   ▼
[ Upstream Reverse Proxy ]  ← 本リポジトリの外（実装は利用者が選択）
   │ via shared network: discord-gamble-bot-net
   ▼
[ nginx (this repo) : 80 ]
   │ default network
   ▼
[ server: Express on :3000 ]
```

## 上流プロキシ側への契約（最小仕様）

| 項目 | 値 |
|---|---|
| Docker ネットワーク名 | `discord-gamble-bot-net`（`external: true` で参加） |
| Upstream service | `nginx`（多くの上流プロキシも `nginx` という service 名を使うため、**network alias `discord-gamble-bot-nginx` を併用**することを推奨） |
| Upstream port | `80` |
| Healthcheck path | `/health`（200 `ok` を返す） |
| 期待パス | 上流プロキシが `/discord-gamble-bot/` → `http://discord-gamble-bot-nginx:80/` にプレフィックス除去でプロキシする前提 |

Traefik ラベル / Nginx upstream / Caddy 設定などの具体記述は **上流プロキシ側リポジトリ** で持ってください。本リポジトリ側の変更は不要です。

## 上流プロキシの選択肢（参考）

- **共用リバプロに相乗り** — 同一ワークスペースの `reverse-proxy` プロジェクトは、複数サービスを同居させる共用リバプロとして運用されています。上記契約を満たせば upstream を1件足すだけで接続可能
- **単独で導入** — 本プロジェクト専用に Traefik / Nginx / Caddy などを立てても構いません。上記契約さえ守られれば本プロジェクト側の変更は不要

## 開発時

- 上流プロキシは不要。`docker compose up -d` で内部ネットワーク単体で動作検証可能
- ホストから `nginx` へ直接アクセスしたい場合は一時的に `ports: ["127.0.0.1:8080:80"]` を加える（本番では削除）
- あるいは `server` に `localhost:3000` で直接続（`server` は `127.0.0.1:3000` bind 済）

## 本番（上流プロキシ経由）時

- 上流プロキシが `discord-gamble-bot-net` に参加している必要がある
- ホスト 80/443 は上流プロキシが占有（本 repo は bind しない）
- `.env` の `CORS_ALLOWED_ORIGINS` を上流プロキシの公開オリジンに合わせる

## 切替確認チェックリスト

- [ ] 共有ネットワーク `discord-gamble-bot-net` が存在（`docker network ls | grep discord-gamble-bot-net`）
- [ ] 上流プロキシ側 compose で `networks.discord-gamble-bot-net.external: true`
- [ ] 上流プロキシ → `nginx:80/health` の疎通が 200 `ok` 返却
- [ ] ホスト 80/443 に本 repo の nginx が bind していない
