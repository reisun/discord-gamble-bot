# bet_options（賭け項目）

| カラム名 | 型 | NOT NULL | デフォルト | 説明 |
|---------|-----|---------|-----------|------|
| `id` | SERIAL | ○ | - | PK |
| `game_id` | INTEGER | ○ | - | FK → games.id |
| `symbol` | VARCHAR(5) | ○ | - | 記号（A〜Z または 1〜9、同一ゲーム内で一意） |
| `label` | VARCHAR(50) | ○ | - | 項目名（例: チームA） |
| `order` | INTEGER | ○ | 1 | 表示順 |
| `created_at` | TIMESTAMPTZ | ○ | NOW() | 作成日時 |

## インデックス
- PRIMARY KEY: `id`
- UNIQUE: `(game_id, symbol)` ← 同一ゲーム内で記号の重複を防ぐ
- INDEX: `game_id`
- FOREIGN KEY: `game_id` → `games(id)` ON DELETE CASCADE
