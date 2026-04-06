# ユーザー API

## ユーザー一覧取得
```
GET /api/users
```

`points` および `debt` はキャッシュ値ではなく、クエリパラメータ `eventId` で指定したイベントの履歴テーブルから集計した値を返す。`debt` フィールドは管理者トークンが付与されている場合のみレスポンスに含まれる。

**クエリパラメータ**

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| eventId | ○ | 集計対象のイベントID |

**レスポンス（一般）**
```json
{
  "data": [
    {
      "id": 1,
      "discordId": "123456789012345678",
      "discordName": "User A",
      "points": 1500
    }
  ]
}
```

**レスポンス（管理者）**
```json
{
  "data": [
    {
      "id": 1,
      "discordId": "123456789012345678",
      "discordName": "User A",
      "points": 1500,
      "debt": 3000
    }
  ]
}
```

---

## ユーザー詳細取得
```
GET /api/users/:id
```

`points` / `debt` はイベント単位の集計値。`eventId` を省略した場合は開催中イベント（`is_active = TRUE`）を使用する。  
`debt` フィールドは管理者トークンが付与されている場合のみレスポンスに含まれる。

**クエリパラメータ**

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| eventId | - | 集計対象のイベントID。省略時は開催中イベント |

**レスポンス（一般）**
```json
{
  "data": {
    "id": 1,
    "discordId": "123456789012345678",
    "discordName": "User A",
    "points": 1500,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

**レスポンス（管理者）**
```json
{
  "data": {
    "id": 1,
    "discordId": "123456789012345678",
    "discordName": "User A",
    "points": 1500,
    "debt": 3000,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

---

## ユーザー取得（Discord ID 指定）
```
GET /api/users/discord/:discordId
```

クエリパラメータ・レスポンス形式はユーザー詳細取得（`GET /api/users/:id`）と同形式。

---

## ポイント履歴取得
```
GET /api/users/:id/point-history
```

**レスポンス**
```json
{
  "data": [
    {
      "id": 1,
      "gameId": 1,
      "gameTitle": "第1試合",
      "changeAmount": 70,
      "reason": "game_result",
      "createdAt": "2024-01-01T12:30:00Z"
    }
  ]
}
```

---

## ユーザーのイベント内賭け一覧取得
```
GET /api/users/:id/event-bets/:eventId
```

管理者トークン不要。Discord Bot の `/mybets` コマンドから使用する。

**パスパラメータ**

| パラメータ | 説明 |
|-----------|------|
| id | ユーザーID（内部） |
| eventId | イベントID |

**レスポンス**
```json
{
  "data": {
    "eventId": 1,
    "eventName": "〇〇大会",
    "currentPoints": 9720,
    "bets": [
      {
        "gameId": 1,
        "gameTitle": "第1試合",
        "gameStatus": "finished",
        "betType": "single",
        "requiredSelections": null,
        "deadline": "2024-01-01T12:00:00Z",
        "selectedSymbols": "A",
        "selectedLabels": ["チームA"],
        "amount": 50,
        "isDebt": false,
        "odds": null,
        "estimatedPayout": null,
        "result": "win",
        "pointChange": 70
      },
      {
        "gameId": 3,
        "gameTitle": "第3試合",
        "gameStatus": "open",
        "betType": "multi_ordered",
        "requiredSelections": 3,
        "deadline": "2024-01-02T12:00:00Z",
        "selectedSymbols": "BDE",
        "selectedLabels": ["チームB", "チームD", "チームE"],
        "amount": 200,
        "isDebt": false,
        "odds": 1.8,
        "estimatedPayout": 160,
        "result": null,
        "pointChange": null
      }
    ]
  }
}
```

| フィールド | 説明 |
|-----------|------|
| `currentPoints` | 現時点での所持ポイント（`events.initial_points + SUM(point_history)`） |
| `betType` | 賭け方式（`single` / `multi_unordered` / `multi_ordered` / `multi_ordered_dup`） |
| `requiredSelections` | 選択必要数（`single` 時は `null`） |
| `selectedSymbols` | 登録済みの記号文字列（`multi_unordered` はソート済み） |
| `selectedLabels` | 記号に対応する項目名の配列（記号の順序と一致） |
| `gameStatus` | `open`（受付中）/ `closed`（締切済）/ `finished`（結果確定） |
| `odds` | 組み合わせのパリミュチュエル倍率（`finished` 時は `null`） |
| `estimatedPayout` | 現在倍率での当選時獲得ポイント予定（`finished` 時は `null`） |
| `result` | `win` / `lose` / `null`（未確定） |
| `pointChange` | ゲーム確定後のポイント増減（`finished` 時のみ。`win` は正値、`loss` は `0`） |

---

## ユーザーのイベント別賭け結果取得
```
GET /api/users/:id/event-results/:eventId
```

**レスポンス**
```json
{
  "data": {
    "userId": 1,
    "eventId": 1,
    "totalPointChange": 500,
    "totalDebt": 80,
    "totalAssets": 10420,
    "totalAssetsChange": -580,
    "wins": 3,
    "losses": 1,
    "games": [
      {
        "gameId": 1,
        "gameTitle": "第1試合",
        "betType": "single",
        "requiredSelections": null,
        "selectedSymbols": "A",
        "selectedLabels": ["チームA"],
        "amount": 50,
        "isDebt": false,
        "debtChange": 0,
        "pointChange": 70,
        "result": "win"
      }
    ]
  }
}
```

| フィールド | 説明 |
|-----------|------|
| `totalPointChange` | イベント中のポイント増減合計 |
| `totalDebt` | イベント内の借金総額（`SUM(debt_history.change_amount) WHERE user_id=? AND event_id=?`） |
| `totalAssets` | `最終所持ポイント - totalDebt` |
| `totalAssetsChange` | `totalAssets - events.initial_points` |
| `selectedSymbols` | 登録済みの記号文字列（`multi_unordered` はソート済み） |
| `selectedLabels` | 記号に対応する項目名の配列 |
| `debtChange` | そのゲームで増加した借金額（借金賭けなし時は `0`） |
