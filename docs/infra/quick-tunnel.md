# Quick Tunnel 接続仕様

- GitHub Pages 起動時に BASE_URL 下の `config.json` を `cache: no-store` で取得する。
- `apiBaseUrl` は完全な HTTPS URL。認証情報・クエリ・フラグメントを拒否する。
- 本番で欠落・不正な設定は画面にエラーを表示し、旧リバプロには接続しない。
- 開発モードでは従来のローカル接続設定を使う。
- Pages ワークフローは `workflow_dispatch` の `api_base_url` を優先し、未指定時にリポジトリ変数 `QUICK_TUNNEL_URL` を使う。生成ファイルはコミットしない。
- ワークスペースの `reverse-proxy/scripts/quick-tunnels.py` が Docker 起動・URL 取得・変数更新・Pages デプロイを行う。
- Quick Tunnel 再起動で URL が変わるため、設定の再生成と Pages デプロイが必要。

## API

トンネルの接続先は `nginx:80`。公開 API は `/api`、ヘルスチェックは `/health` と `/api/health`。画面は `apiBaseUrl` に `/api` を追加する。Bot 専用 `/internal` は nginx 経由で公開しない。CORS 許可オリジンの既定値は `https://reisun.github.io`。
