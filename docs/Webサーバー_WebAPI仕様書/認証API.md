# 認証 API

## トークン検証
```
GET /api/auth/verify
```

**クエリパラメータ**

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| token | △ | 検証するトークン（省略時は `isAdmin: false` を返す） |

**処理フロー**
1. token が ADMIN_TOKEN と一致 → `{ isAdmin: true }`
2. token が DB に存在し期限内 → `{ isAdmin: role === 'editor' }`
3. token が DB に存在するが期限切れ → `401 TOKEN_EXPIRED`
4. token なし → `{ isAdmin: false }`

**レスポンス**
```json
{
  "data": {
    "isAdmin": true
  }
}
```

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 401 | TOKEN_EXPIRED | トークンが期限切れ。`/dashboard` を再実行してください |

---

## トークン生成（bot用）
```
POST /api/auth/token
```

**認証**: `Authorization: Bearer ${ADMIN_TOKEN}` ヘッダー必須

**リクエストボディ**

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| guildId | ○ | 対象ギルドID |
| role | ○ | `editor` または `viewer` |

**レスポンス**
```json
{
  "data": {
    "token": "生トークン文字列（64文字hex）"
  }
}
```

- トークンは SHA-256 ハッシュで DB に保存（生トークンは非保存）
- 有効期限: 12時間
- 同一トークンを期限内は繰り返し使用可能（ワンタイムではない）

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 401 | UNAUTHORIZED | 認証ヘッダーなし |
| 403 | FORBIDDEN | ADMIN_TOKEN 不一致 |
| 400 | VALIDATION_ERROR | guildId または role が不正 |
