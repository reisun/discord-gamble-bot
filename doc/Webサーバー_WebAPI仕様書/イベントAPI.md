# イベント API

## イベント一覧取得
```
GET /api/events
```

**レスポンス**
```json
{
  "data": [
    {
      "id": 1,
      "name": "〇〇大会",
      "isActive": true,
      "initialPoints": 10000,
      "resultsPublic": false,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

## イベント詳細取得
```
GET /api/events/:id
```

**パスパラメータ**

| パラメータ | 説明 |
|-----------|------|
| id | イベントID |

**レスポンス**
```json
{
  "data": {
    "id": 1,
    "name": "〇〇大会",
    "isActive": true,
    "initialPoints": 10000,
    "resultsPublic": false,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

---

## イベント作成
```
POST /api/events
```
**権限**: 管理者のみ

**リクエストボディ**
```json
{
  "name": "〇〇大会",
  "initialPoints": 10000,
  "resultsPublic": false
}
```

| フィールド | 型 | 必須 | バリデーション |
|-----------|-----|------|--------------|
| name | string | ○ | 1〜100文字 |
| initialPoints | number | - | 1以上の整数（省略時: 10000） |
| resultsPublic | boolean | - | 省略時: `false` |

**レスポンス**: `201 Created`
```json
{
  "data": {
    "id": 2,
    "name": "〇〇大会",
    "isActive": false,
    "initialPoints": 10000,
    "resultsPublic": false,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

---

## イベント更新
```
PUT /api/events/:id
```
**権限**: 管理者のみ

**リクエストボディ**
```json
{
  "name": "〇〇大会（改）",
  "initialPoints": 5000,
  "resultsPublic": true
}
```

**レスポンス**: `200 OK` (イベント詳細と同形式)

---

## イベント削除
```
DELETE /api/events/:id
```
**権限**: 管理者のみ

**レスポンス**: `204 No Content`

---

## 開催中イベント切り替え
```
PATCH /api/events/:id/activate
```
**権限**: 管理者のみ

指定したイベントを開催中にし、他のイベントはすべて非開催にする。  
開催中イベントの1件制限は API サーバー側のトランザクション内で制御する（DB制約なし）。

処理内容:
1. `UPDATE events SET is_active = FALSE WHERE is_active = TRUE`
2. `UPDATE events SET is_active = TRUE WHERE id = :id`

**レスポンス**: `200 OK` (イベント詳細と同形式)
