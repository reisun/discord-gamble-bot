# Quick Tunnel 接続仕様

- GitHub Pages 起動時に BASE_URL 下の `config.json` を `cache: no-store` で取得する。
- `apiBaseUrl` は完全な HTTPS URL。認証情報・クエリ・フラグメントを拒否する。
- 本番で欠落・不正な設定は画面にエラーを表示し、旧リバプロには接続しない。
- 開発モードでは従来のローカル接続設定を使う。
- Pages ワークフローは `workflow_dispatch` の `api_base_url` を優先し、未指定時にリポジトリ変数 `QUICK_TUNNEL_URL` を使う。生成ファイルはコミットしない。
- ワークスペースの `reverse-proxy/scripts/quick-tunnels.py` が Docker 起動・URL 取得・変数更新・Pages デプロイを行う。
- Quick Tunnel 再起動で URL が変わるため、設定の再生成と Pages デプロイが必要。

## API

トンネルの接続先は `server:3000`。公開 API は `/api`、ヘルスチェックは `/api/health`。画面は `apiBaseUrl` に `/api` を追加する。公開リスナーに Bot 専用 `/internal` は登録しない（404）。Bot はホスト非公開の内部リスナー `server:3002` に `BOT_API_BASE_URL` で接続し、`/internal/api/auth/token` からトークンを取得する。同じ内部リスナーで通常の `/api` もトークン認証付きで提供する。CORS 許可オリジンの既定値は `https://reisun.github.io`。

## リスナー分離の検証

Server のテストは `DATABASE_URL` を指定して専用の一時 PostgreSQL に接続できる。本番 DB を使用しない。公開 `/internal/api/auth/token` は 404、公開 `/api/auth/token` の未認証要求は 401。内部リスナーで取得したトークンは公開・内部の通常 API で検証される。内部の通常 API も未認証の管理操作を拒否する。Compose は内部ポート 3002 をホスト公開しない。
