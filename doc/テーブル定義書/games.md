# games（ゲーム）

| カラム名 | 型 | NOT NULL | デフォルト | 説明 |
|---------|-----|---------|-----------|------|
| `id` | SERIAL | ○ | - | PK |
| `event_id` | INTEGER | ○ | - | FK → events.id |
| `title` | VARCHAR(100) | ○ | - | ゲームタイトル |
| `description` | TEXT | - | NULL | 説明 |
| `deadline` | TIMESTAMPTZ | ○ | - | 賭け締め切り日時 |
| `is_published` | BOOLEAN | ○ | FALSE | 公開フラグ |
| `status` | VARCHAR(20) | ○ | 'open' | ゲーム状態（open / closed / finished） |
| `bet_type` | VARCHAR(30) | ○ | 'single' | 賭け方式（`single` / `multi_unordered` / `multi_ordered` / `multi_ordered_dup`） |
| `required_selections` | INTEGER | - | NULL | 選択必要数（`single` 時は NULL、複数方式時は 2 以上） |
| `result_symbols` | VARCHAR(100) | - | NULL | 当選の記号結合文字列（例: `"A"`, `"BDE"`）。`bets.selected_symbols` と同じ正規化形式 |
| `created_at` | TIMESTAMPTZ | ○ | NOW() | 作成日時 |
| `updated_at` | TIMESTAMPTZ | ○ | NOW() | 更新日時 |

## インデックス
- PRIMARY KEY: `id`
- INDEX: `event_id`
- FOREIGN KEY: `event_id` → `events(id)` ON DELETE CASCADE

## CHECK 制約
- `status IN ('open', 'closed', 'finished')`
- `bet_type IN ('single', 'multi_unordered', 'multi_ordered', 'multi_ordered_dup')`
- `(bet_type = 'single' AND required_selections IS NULL) OR (bet_type != 'single' AND required_selections >= 2)`
