# bets（賭け）

| カラム名 | 型 | NOT NULL | デフォルト | 説明 |
|---------|-----|---------|-----------|------|
| `id` | SERIAL | ○ | - | PK |
| `user_id` | INTEGER | ○ | - | FK → users.id |
| `game_id` | INTEGER | ○ | - | FK → games.id |
| `selected_symbols` | VARCHAR(100) | ○ | - | 選択した記号の結合文字列（例: `"A"`, `"BDE"`, `"BBD"`） |
| `amount` | INTEGER | ○ | - | 賭けたポイント数 |
| `is_debt` | BOOLEAN | ○ | FALSE | 借金による賭けかどうか |
| `created_at` | TIMESTAMPTZ | ○ | NOW() | 作成日時 |
| `updated_at` | TIMESTAMPTZ | ○ | NOW() | 更新日時（上書き時に更新） |

## インデックス
- PRIMARY KEY: `id`
- UNIQUE: `(user_id, game_id)` ← 上書き（upsert）のキーとして使用
- INDEX: `game_id`
- FOREIGN KEY: `user_id` → `users(id)` ON DELETE CASCADE
- FOREIGN KEY: `game_id` → `games(id)` ON DELETE CASCADE

## CHECK 制約
- `amount > 0`

## `selected_symbols` の形式

| 方式 | 例 | 備考 |
|------|-----|------|
| `single` | `"A"` | 1文字 |
| `multi_unordered` | `"BDE"` | API側でソート済み（昇順）。重複なし |
| `multi_ordered` | `"BDE"` | 入力順。重複なし |
| `multi_ordered_dup` | `"BBD"` | 入力順。同一記号の重複あり |

## 備考
- 同一ゲームへの賭けは上書き（upsert）する。賭け変更時は旧賭けの種別に応じた返却レコードを `point_history` / `debt_history` に挿入し、新賭けの消費レコードを追加する。
