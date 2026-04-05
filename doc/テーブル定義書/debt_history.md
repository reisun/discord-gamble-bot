# debt_history（借金履歴）

借金はポイントと同様にイベント単位で管理する。イベント内の現在借金額は以下の式で集計する。

```
借金総額（イベント内） = SUM(change_amount) WHERE user_id = ? AND event_id = ?
```

| カラム名 | 型 | NOT NULL | デフォルト | 説明 |
|---------|-----|---------|-----------|------|
| `id` | SERIAL | ○ | - | PK |
| `user_id` | INTEGER | ○ | - | FK → users.id |
| `event_id` | INTEGER | ○ | - | FK → events.id（必須：借金はイベント単位で管理） |
| `game_id` | INTEGER | - | NULL | FK → games.id（賭け起因の変動の場合のみ） |
| `change_amount` | INTEGER | ○ | - | 借金変動量（正: 増加 / 負: 減少） |
| `reason` | VARCHAR(50) | ○ | - | 変動理由 |
| `created_at` | TIMESTAMPTZ | ○ | NOW() | 作成日時 |

## インデックス
- PRIMARY KEY: `id`
- INDEX: `(user_id, event_id)` ← イベント内集計の主要クエリに使用
- INDEX: `game_id`
- FOREIGN KEY: `user_id` → `users(id)` ON DELETE CASCADE
- FOREIGN KEY: `event_id` → `events(id)` ON DELETE CASCADE
- FOREIGN KEY: `game_id` → `games(id)` ON DELETE SET NULL

## reason の値一覧

| 値 | 説明 | game_id |
|----|------|---------|
| `bet_placed` | 借金賭け時の借金増加（正の値） | ○ |
| `bet_refunded` | 借金賭け変更時の返却（負の値） | ○ |
| `game_deleted` | ゲーム削除時の打ち消し差分 | ○ |
| `admin_repay` | 管理者による返済（将来機能、負の値） | - |
