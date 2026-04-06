# AGENT.md

## 設計書
- `./docs` 以下に配置する
- 画面別、ページ別、API別など、対象単位を分けて作成する
- サービスが複数ある場合は、サービス別にディレクトリを分ける

## 実行環境
- Windows + WSL2 Ubuntu（mirror mode）
- Docker Desktop（WSL backend）
- 開発環境は docker-compose で構築（WSL2内を汚さない）

## 作業範囲
- 操作許可は **プロジェクトのリポジトリ内** のみとする
- 外部リポジトリ、submodule、共有 volume を扱う場合は **人間確認** を必須とする
- `/mnt/c` へのアクセスは禁止

## 禁止事項
- `sudo`
- `rm -rf`
- `git push --force`、`git reset --hard`、`git clean -fdx`（承認なし）
- `docker *prune*`、`docker compose down -v`（承認なし）

## Git
- feature ブランチで作業、`main`/`develop` への直接変更禁止
- 変更は小さく、レビュー可能な単位でコミット


## 環境変数
- `.env` ファイルはコミット禁止
- secret をログや出力に含めない
- `.env.example` を作成する場合は、ダミー値のみを使用する

## Docker
- 許可: `up`, `stop`, `start`, `restart`, `ps`, `logs`, `build`
- 要確認: `down -v`, volume / image 削除