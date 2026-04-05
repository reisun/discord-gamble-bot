# TLS certificates

このディレクトリには nginx が使用する TLS 証明書を配置します。

必要なファイル:

- `fullchain.pem`
- `key.pem`

`fullchain.pem` はサーバー証明書 `cert.pem` と CA 証明書 `cert.crt` を結合して作成します。

```bash
cd docker/nginx/certs
cat cert.pem cert.crt > fullchain.pem
cp key.pem ./key.pem
```

注意:

- `fullchain.pem` と `key.pem` は機密情報のため Git 管理しません
- このディレクトリ配下が空だと `nginx` コンテナは起動時にエラー終了します
- `docker compose up -d --build nginx` の前に、上記2ファイルが存在することを確認してください
