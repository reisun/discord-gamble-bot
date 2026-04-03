# イベント API

## イベント一覧取得
```
GET /api/events
```

管理者トークン付きの場合は全イベントを返す。  
トークンなし（一般ユーザー）の場合は `is_published = TRUE` のイベントのみ返す。

**レスポンス**
```json
{
  "data": [
    {
      "id": 1,
      "name": "〇〇大会",
      "isActive": true,
      "isPublished": true,
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
    "isPublished": true,
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
    "isPublished": false,
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

## 開催状態切り替え（トグル）
```
PATCH /api/events/:id/activate
```
**権限**: 管理者のみ

指定したイベントの開催状態をトグルする。

- **非開催 → 開催**: 他の開催中イベントをすべて非開催にしてから対象を開催中にする。  
  同時に `is_published = TRUE` を強制する（開催中イベントは必ず公開）。
- **開催中 → 非開催**: 対象イベントを非開催にする（他への影響なし）。  
  `is_published` は変更しない。

開催中イベントが0件になることも許容する。

**レスポンス**: `200 OK` (イベント詳細と同形式)

---

## イベント公開/非公開切り替え
```
PATCH /api/events/:id/publish
```
**権限**: 管理者のみ

**リクエストボディ**
```json
{
  "isPublished": true
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| isPublished | boolean | ○ | `true` で公開、`false` で非公開 |

**制約**: 開催中（`is_active = TRUE`）のイベントを非公開（`isPublished: false`）にすることはできない。

**エラーレスポンス**

| HTTPステータス | コード | 説明 |
|--------------|--------|------|
| 400 | `INVALID_OPERATION` | 開催中イベントを非公開にしようとした |
| 400 | `VALIDATION_ERROR` | `isPublished` が boolean でない |
| 404 | `NOT_FOUND` | 指定IDのイベントが存在しない |

**レスポンス**: `200 OK` (イベント詳細と同形式)
