# ゲーム API

## ゲーム一覧取得
```
GET /api/events/:eventId/games
```

**クエリパラメータ**

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| includeUnpublished | - | `true` で非公開も含む（管理者のみ有効） |

**レスポンス**
```json
{
  "data": [
    {
      "id": 1,
      "eventId": 1,
      "title": "第1試合",
      "description": "...",
      "deadline": "2024-01-01T12:00:00Z",
      "isPublished": true,
      "status": "open",
      "betType": "single",
      "requiredSelections": null,
      "resultSymbols": null,
      "betOptions": [
        { "id": 1, "symbol": "A", "label": "チームA", "order": 1 },
        { "id": 2, "symbol": "B", "label": "チームB", "order": 2 }
      ],
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

`status` の値:

| 値 | 説明 |
|----|------|
| `open` | 賭け受付中 |
| `closed` | 締め切り済み（結果未確定） |
| `finished` | 結果確定済み |

---

## ゲーム詳細取得
```
GET /api/games/:id
```

**レスポンス**: ゲーム一覧の各要素と同形式

---

## ゲーム作成
```
POST /api/events/:eventId/games
```
**権限**: 管理者のみ

**リクエストボディ**
```json
{
  "title": "第1試合",
  "description": "説明文",
  "deadline": "2024-01-01T12:00:00Z",
  "betType": "single",
  "requiredSelections": null,
  "betOptions": [
    { "symbol": "A", "label": "チームA" },
    { "symbol": "B", "label": "チームB" }
  ]
}
```

| フィールド | 型 | 必須 | バリデーション |
|-----------|-----|------|--------------|
| title | string | ○ | 1〜100文字 |
| description | string | - | 最大500文字 |
| deadline | ISO8601 | ○ | 現在時刻より未来 |
| betType | string | - | `single` / `multi_unordered` / `multi_ordered` / `multi_ordered_dup`（省略時: `single`） |
| requiredSelections | number | 条件付き | `betType` が `single` 以外の場合に必須。2以上の整数。`single` 時は省略または `null` |
| betOptions | object[] | ○ | 2要素以上。`betType` が複数方式の場合は `requiredSelections` 以上の要素数が必要 |
| betOptions[].symbol | string | ○ | 半角英字(A〜Z)または半角数字(1〜9)、同一リスト内で一意 |
| betOptions[].label | string | ○ | 1〜50文字 |

**レスポンス**: `201 Created` (ゲーム詳細と同形式)

---

## ゲーム更新
```
PUT /api/games/:id
```
**権限**: 管理者のみ

**制約**:

| 状態 | 変更可能フィールド |
|------|------------------|
| 非公開（`is_published = false`） | すべてのフィールド |
| 公開済み（`is_published = true`） | `title`、`description`、`betOptions[].label` のみ |

公開済みゲームで上記以外のフィールド（`deadline`、`betType`、`requiredSelections`、`betOptions` の追加・削除、`betOptions[].symbol`）を変更しようとした場合は `409 CONFLICT` を返す。

**リクエストボディ**: ゲーム作成と同形式（公開済み時は制約外フィールドを無視するか `409` を返す）

**レスポンス**: `200 OK` (ゲーム詳細と同形式)

---

## ゲーム削除
```
DELETE /api/games/:id
```
**権限**: 管理者のみ

処理内容:
1. `point_history` を `game_id = ?` 単位で `user_id, event_id` ごとに集計
2. 集計結果の逆符号を `point_history` に INSERT（`reason = 'game_deleted'`）
3. `debt_history` も同様に逆符号を `debt_history` に INSERT（`reason = 'game_deleted'`）
4. ゲーム本体を削除

**備考**:
- 賭け変更や結果確定を含む、そのゲーム起因の履歴を合算して打ち消す
- 削除後、既存の履歴と打ち消し履歴の `game_id` は FK 制約により `NULL` になる

**レスポンス**: `204 No Content`

---

## 公開・非公開切り替え
```
PATCH /api/games/:id/publish
```
**権限**: 管理者のみ

**リクエストボディ**
```json
{
  "isPublished": true
}
```

**レスポンス**: `200 OK` (ゲーム詳細と同形式)

---

## 結果確定・修正
```
PATCH /api/games/:id/result
```
**権限**: 管理者のみ  
**制約**: `status` が `closed` のゲームのみ（修正時は `finished` も可）

**リクエストボディ**
```json
{
  "resultSymbols": "BDE"
}
```

| フィールド | 型 | 必須 | バリデーション |
|-----------|-----|------|--------------|
| resultSymbols | string | ○ | 各文字がゲームの `bet_options.symbol` に存在すること。`betType` に応じた制約を適用 |

**`betType` ごとのバリデーション**:
- `single`: 1文字のみ
- `multi_unordered`: `requiredSelections` 文字、重複なし。API側でソートして正規化
- `multi_ordered`: `requiredSelections` 文字、重複なし。入力順を保持
- `multi_ordered_dup`: `requiredSelections` 文字、重複あり。入力順を保持

処理内容:
1. `resultSymbols` を正規化（`multi_unordered` はソート）
2. `games.result_symbols` を更新
3. `games.status` を `finished` に更新
4. `DELETE FROM point_history WHERE game_id = ? AND reason = 'game_result'`（結果修正時の冪等性確保）
5. `bets.selected_symbols = games.result_symbols` の一致判定で当選者を特定
6. 当選した賭けごとに獲得ポイントを計算し `point_history` に INSERT（`reason = 'game_result'`）

**備考**: 結果を修正する場合は同エンドポイントを再度呼び出す。手順4の DELETE により旧レコードが除去され、新結果で再計算される。`debt_history` は変更不要。

**レスポンス**: `200 OK` (ゲーム詳細と同形式)
