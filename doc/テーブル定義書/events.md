# events（イベント）

| カラム名 | 型 | NOT NULL | デフォルト | 説明 |
|---------|-----|---------|-----------|------|
| `id` | SERIAL | ○ | - | PK |
| `name` | VARCHAR(100) | ○ | - | イベント名 |
| `is_active` | BOOLEAN | ○ | FALSE | 開催中フラグ |
| `initial_points` | INTEGER | ○ | 10000 | イベント参加者の初期付与ポイント |
| `results_public` | BOOLEAN | ○ | FALSE | ユーザー結果一覧を一般公開するか |
| `created_at` | TIMESTAMPTZ | ○ | NOW() | 作成日時 |
| `updated_at` | TIMESTAMPTZ | ○ | NOW() | 更新日時 |

## インデックス
- PRIMARY KEY: `id`

## 備考
- `is_active = TRUE` のレコードは1件のみとなるよう API サーバー側で制御する（DB制約なし）
