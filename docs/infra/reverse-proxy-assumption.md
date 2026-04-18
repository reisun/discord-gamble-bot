# Reverse Proxy Assumption — 本プロジェクトのスコープ外明示

## 立ち位置

本プロジェクト (`discord_gamble_bot`) は、**自宅 Docker の親リバースプロキシ（別プロジェクト `workspace/reverse-proxy`）が前段に立つ前提** で運用されます。本リポジトリは TLS 終端やホストポート 80/443 の公開を自身で行いません。

## 本プロジェクトが扱う範囲

- `nginx` コンテナを `:80` で HTTP 公開（ホストポートには bind しない）
- 共有 Docker ネットワーク `discord-gamble-bot-net` 上で `nginx:80` として可用にする
- 既存の `/api` ルーティング（Express サーバーへの proxy）は `nginx` が担当
- `/health` 返却

## 本プロジェクトが扱わない範囲

- TLS 証明書（Let's Encrypt 等）
- 公開ドメインの取得・DNS
- ホストポート 80/443 の公開
- ホストファイアウォールのポート許可（ルーター側ポート転送は親 reverse-proxy 側で設定）

## 想定される接続図

```
Internet
   │
   ▼ 443
[ Home Router / Public Domain ]
   │
   ▼
[ 親 reverse-proxy container (workspace/reverse-proxy) ]
   │ via shared network: discord-gamble-bot-net
   ▼
[ nginx (this repo) : 80 ]
   │ via default network
   ▼
[ server: Express on :3000 ]
```

## 親 reverse-proxy 側への仕様メモ

親 reverse-proxy が本プロジェクトを取り込む際の最小情報:

- Docker ネットワーク名: `discord-gamble-bot-net`
- Upstream service: `nginx`（親リバプロ側も `nginx` という service 名を使うため、**network alias `discord-gamble-bot-nginx` を併用**）
- Upstream port: `80`
- Healthcheck path: `/health`
- 期待パス: 親リバプロが `/discord-gamble-bot/` → `http://discord-gamble-bot-nginx:80/` にプロキシする前提（プレフィックス除去）

## 開発時

- 親 reverse-proxy は不要。`docker compose up -d` で内部ネットワークのみで動作検証する場合、ホストから `nginx` へアクセスするには一時的に `ports: ["127.0.0.1:8080:80"]` を加える（本番では削除）。
- または `server` に直接 `localhost:3000` で接続可（`server` が `127.0.0.1:3000` で bind 済）。

## 本番（親 reverse-proxy 経由）時

- 親 reverse-proxy が `discord-gamble-bot-net` に参加している必要がある
- ホスト 80/443 は親 reverse-proxy が占有
- CORS は `.env` の `CORS_ALLOWED_ORIGINS` を親 reverse-proxy の公開オリジンに合わせる

## 切替確認チェックリスト

- [ ] 共有ネットワーク `discord-gamble-bot-net` が存在（`docker network ls | grep discord-gamble-bot-net`）
- [ ] 親 reverse-proxy 側 compose で `networks.discord-gamble-bot-net.external: true`
- [ ] 親 reverse-proxy → `nginx:80/health` の疎通が 200 返却
- [ ] ホスト 80/443 に本 repo の nginx が bind していない
