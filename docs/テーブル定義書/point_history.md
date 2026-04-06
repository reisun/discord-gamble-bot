# point_history（ポイント履歴）

ポイントはイベントごとにリセットされる。イベント内の現在ポイントは以下の式で集計する。

```
現在ポイント = events.initial_points + SUM(change_amount)
              WHERE user_id = ? AND event_id = ?
```

| カラム名 | 型 | NOT NULL | デフォルト | 説明 |
|---------|-----|---------|-----------|------|
| `id` | SERIAL | ○ | - | PK |
| `user_id` | INTEGER | ○ | - | FK → users.id |
| `event_id` | INTEGER | ○ | - | FK → events.id（必須：ポイントはイベント単位で管理） |
| `game_id` | INTEGER | - | NULL | FK → games.id（ゲーム起因の変動の場合のみ） |
| `change_amount` | INTEGER | ○ | - | ポイント変動量（正: 増加 / 負: 減少） |
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
| `bet_placed` | 賭け時のポイント消費（負の値） | ○ |
| `bet_refunded` | 賭け変更時の旧賭け返却（正の値） | ○ |
| `game_result` | ゲーム当選時のポイント獲得（正の値） | ○ |
| `admin_adjust` | 管理者による手動調整 | - |

## 備考
- `game_result` レコードはゲーム結果修正時に `DELETE WHERE game_id=? AND reason='game_result'` してから再 INSERT することで冪等に修正できる
