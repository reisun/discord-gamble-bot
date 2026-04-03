# events（イベント）

| カラム名 | 型 | NOT NULL | デフォルト | 説明 |
|---------|-----|---------|-----------|------|
| `id` | SERIAL | ○ | - | PK |
| `name` | VARCHAR(100) | ○ | - | イベント名 |
| `is_active` | BOOLEAN | ○ | FALSE | 開催中フラグ |
| `is_published` | BOOLEAN | ○ | FALSE | 公開フラグ（一般ユーザーから見えるか） |
| `initial_points` | INTEGER | ○ | 10000 | イベント参加者の初期付与ポイント |
| `results_public` | BOOLEAN | ○ | FALSE | ユーザー結果一覧を一般公開するか |
| `created_at` | TIMESTAMPTZ | ○ | NOW() | 作成日時 |
| `updated_at` | TIMESTAMPTZ | ○ | NOW() | 更新日時 |

## インデックス
- PRIMARY KEY: `id`

## 備考
- `is_active = TRUE` のレコードは最大1件となるよう API サーバー側で制御する（DB制約なし）。  
  開催中イベントが0件の状態も許容する。
- `is_active = TRUE` にする際は `is_published` を強制的に `TRUE` にする。
- `is_active = TRUE` のイベントを `is_published = FALSE` にすることは API 側で禁止する。
