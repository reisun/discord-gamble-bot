# 賭け状況 API

## ゲームの賭け状況取得
```
GET /api/games/:gameId/bets
```

**倍率計算（パリミュチュエル方式）**

集計単位は `bets.selected_symbols` の組み合わせ文字列。`single` / 複数方式を問わず同一ロジックで計算する。

```
組み合わせの倍率 = 総賭けポイント合計 ÷ その組み合わせへの賭けポイント合計
当選時獲得ポイント = 賭けたポイント × 倍率（小数点以下切り捨て）
```

人気（賭けが多い）組み合わせほど倍率が低く、不人気組み合わせほど倍率が高くなる。

**レスポンス**
```json
{
  "data": {
    "betType": "multi_ordered",
    "requiredSelections": 3,
    "totalPoints": 1000,
    "combinations": [
      {
        "selectedSymbols": "BDE",
        "selectedLabels": ["チームB", "チームD", "チームE"],
        "totalPoints": 600,
        "betCount": 3,
        "odds": 1.67
      },
      {
        "selectedSymbols": "BED",
        "selectedLabels": ["チームB", "チームE", "チームD"],
        "totalPoints": 400,
        "betCount": 2,
        "odds": 2.5
      }
    ],
    "bets": [
      {
        "userId": 1,
        "userName": "User A",
        "selectedSymbols": "BDE",
        "selectedLabels": ["チームB", "チームD", "チームE"],
        "amount": 100,
        "isDebt": false,
        "result": "win",
        "pointChange": 167
      }
    ]
  }
}
```

`result` の値: `win` / `lose` / `null`（結果未確定）  
`pointChange`: 結果確定後のみ含まれる（`賭けたポイント × 確定時の倍率`、小数点以下切り捨て）  
`betType = 'single'` 時は `combinations[].selectedSymbols` が1文字、`selectedLabels` が1要素になる（`requiredSelections: null`）

---

## 賭け作成・上書き（upsert）
```
PUT /api/games/:gameId/bets
```

同一ゲームへの賭けが既にある場合は上書きする。

**リクエストボディ**
```json
{
  "discordId": "123456789012345678",
  "selectedSymbols": "BDE",
  "amount": 50,
  "allowDebt": false
}
```

| フィールド | 型 | 必須 | バリデーション |
|-----------|-----|------|--------------|
| discordId | string | ○ | Discord ユーザーID |
| selectedSymbols | string | ○ | 選択する記号の結合文字列。`betType` に応じたバリデーションを適用 |
| amount | number | ○ | 1以上の整数 |
| allowDebt | boolean | - | 借金を許可するか（省略時: `false`） |

**`betType` ごとの `selectedSymbols` バリデーション**:

| 条件 | `single` | `multi_unordered` | `multi_ordered` | `multi_ordered_dup` |
|------|----------|-------------------|-----------------|---------------------|
| 文字数 = `requiredSelections` | ○（1文字） | ○ | ○ | ○ |
| 各文字が `bet_options.symbol` に存在する | ○ | ○ | ○ | ○ |
| 重複文字なし | ○ | ○ | ○ | 不要 |
| 正規化（昇順ソート） | - | ○（API側で実施） | - | - |

**制約**:
- ゲームの `status` が `open` であること
- 締め切り前であること
- `allowDebt = false` の場合、`amount` が所持ポイント以下であること

**処理内容（新規・`allowDebt = false`）**:
1. 集計ポイント（`events.initial_points + SUM(point_history WHERE user_id=? AND event_id=?)`）が `amount` 以上か確認
2. `bets` にレコードを挿入（`is_debt = false`）
3. `point_history` に INSERT（`change_amount = -amount`, `reason = 'bet_placed'`）

**処理内容（新規・`allowDebt = true`）**:
1. `bets` にレコードを挿入（`is_debt = true`）
2. `debt_history` に INSERT（`change_amount = +amount`, `reason = 'bet_placed'`）

**処理内容（上書き時）**:
1. 旧賭けの種別に応じた返却レコードを挿入
   - 旧 `is_debt = false` → `point_history` に INSERT（`change_amount = +旧amount`, `reason = 'bet_refunded'`）
   - 旧 `is_debt = true` → `debt_history` に INSERT（`change_amount = -旧amount`, `reason = 'bet_refunded'`）
2. 賭けレコードを更新（`selected_symbols`, `amount`, `is_debt`, `updated_at`）
3. 新賭けの種別に応じた消費レコードを挿入（新規時と同様）

**処理内容（結果確定時・当選）**:
- `point_history` に INSERT（`change_amount = +獲得ポイント`, `reason = 'game_result'`）（借金との自動相殺なし）

**レスポンス**: `200 OK`（新規作成時も上書き時も同じ）
```json
{
  "data": {
    "id": 1,
    "gameId": 1,
    "userId": 1,
    "selectedSymbols": "BDE",
    "selectedLabels": ["チームB", "チームD", "チームE"],
    "amount": 50,
    "isDebt": false,
    "debtAmount": 0,
    "isUpdated": false,
    "createdAt": "2024-01-01T11:00:00Z",
    "updatedAt": "2024-01-01T11:00:00Z"
  }
}
```

| フィールド | 説明 |
|-----------|------|
| `selectedSymbols` | 登録済みの記号文字列（`multi_unordered` はソート済み） |
| `selectedLabels` | 記号に対応する項目名の配列（記号の順序と一致） |
| `isDebt` | この賭けが借金かどうか |
| `debtAmount` | この賭けで増加した借金額（借金でない場合は `0`） |
| `isUpdated` | 新規作成時 `false`、上書き時 `true` |
