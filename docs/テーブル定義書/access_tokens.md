# access_tokens テーブル

Webアプリへのアクセス用ワンタイムトークンを管理するテーブル。

## カラム定義

| カラム名 | 型 | NULL | 説明 |
|---------|-----|------|------|
| id | serial | NOT NULL | 主キー |
| token_hash | text | NOT NULL | SHA-256 ハッシュ化されたトークン（生トークン非保存） |
| guild_id | varchar(30) | NOT NULL | 対象ギルドID |
| role | varchar(10) | NOT NULL | 権限種別（`editor` または `viewer`） |
| expires_at | timestamptz | NOT NULL | 有効期限（生成から5分） |
| used_at | timestamptz | NULL | 使用日時（未使用は NULL） |
| created_at | timestamptz | NOT NULL | 作成日時（DEFAULT NOW()） |

## インデックス

| インデックス名 | カラム | 説明 |
|--------------|--------|------|
| access_tokens_token_hash_unique | token_hash | 一意制約 |
| access_tokens_guild_id_index | guild_id | 検索用 |

## 制約

- `token_hash`: UNIQUE（同一ハッシュの重複不可）
- `role`: `editor` または `viewer` のみ許容

## セキュリティ設計

- 生トークン（`crypto.randomBytes(32).toString('hex')`）はレスポンスのみで返却し、DB には SHA-256 ハッシュのみ保存
- 有効期限は5分（短期ワンタイムトークン）
- `used_at` が NULL でないトークンは検証失敗扱い（使い回し防止）
