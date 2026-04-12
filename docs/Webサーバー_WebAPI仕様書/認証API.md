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
1. token が DB に存在し期限内 → `{ isAdmin: role === 'editor' }`
2. token が DB に存在するが期限切れ → `401 TOKEN_EXPIRED`
3. token なし → `{ isAdmin: false }`

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

**認証**: 管理者トークン必須。Bot は `/internal/api/auth/token` 経由で認証不要（詳細は[共通仕様 - 内部 API](共通仕様.md#内部-apibot--server)を参照）

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
| 401 | UNAUTHORIZED | 認証トークンなし（公開パス `/api/auth/token` の場合） |
| 401 | TOKEN_EXPIRED | トークンが無効または期限切れ |
| 403 | FORBIDDEN | 管理者権限が必要 |
| 400 | VALIDATION_ERROR | guildId または role が不正 |
