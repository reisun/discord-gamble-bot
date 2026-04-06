# users（ユーザー）

| カラム名 | 型 | NOT NULL | デフォルト | 説明 |
|---------|-----|---------|-----------|------|
| `id` | SERIAL | ○ | - | PK |
| `discord_id` | VARCHAR(30) | ○ | - | Discord ユーザーID（UNIQUE） |
| `discord_name` | VARCHAR(100) | ○ | - | Discord 表示名 |
| `created_at` | TIMESTAMPTZ | ○ | NOW() | 作成日時 |
| `updated_at` | TIMESTAMPTZ | ○ | NOW() | 更新日時 |

## インデックス
- PRIMARY KEY: `id`
- UNIQUE: `discord_id`

## 備考
- ポイント残高・借金残高はカラムとして保持せず、`point_history` / `debt_history` の `SUM(change_amount)` で毎回集計する
