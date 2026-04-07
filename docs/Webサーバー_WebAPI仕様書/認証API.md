# 認証 API

## ワンタイムトークン生成（bot用）
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
- 有効期限: 5分
- 一度使用されたトークンは再使用不可

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 401 | UNAUTHORIZED | 認証ヘッダーなし |
| 403 | FORBIDDEN | ADMIN_TOKEN 不一致 |
| 400 | BAD_REQUEST | guildId または role が不正 |

---

## トークン検証・セッション発行（Webアプリ入口）
```
GET /api/entrance/:guildId?token=XXXX
```

**クエリパラメータ**

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| token | △ | bot が発行したワンタイムトークン（省略時はセッションで判定） |

**処理フロー**
1. token がある場合:
   - トークンを SHA-256 ハッシュ化して DB 検索
   - 有効期限内・未使用・guildId 一致を確認
   - トークンを使用済みにマーク（`used_at` 更新）
   - セッション発行（Cookie: httpOnly, sameSite）
   - `${WEB_APP_BASE_URL}/#/dashboard/:guildId` へ 302 リダイレクト
2. token がない場合:
   - 有効なセッション（guildId 一致）があれば `${WEB_APP_BASE_URL}/#/dashboard/:guildId` へ 302 リダイレクト
   - セッションがなければ 401 エラー（テキスト: 「/link コマンドで取得したリンクが必要です」）

**前提条件**
- nginx で `location /api` が Express サーバーへプロキシされていること
- `WEB_APP_BASE_URL` が設定されていない場合は 503 エラーを返す

**セッション有効期限**

| ロール | 有効期限 |
|--------|---------|
| editor | 2時間 |
| viewer | 24時間 |

**エラーレスポンス**

| 状態 | レスポンス |
|------|----------|
| token なし・セッションなし | 401 エラー |
| 期限切れ・使用済み・guildId不一致 | 400 エラーページ |

---

## セッション情報取得
```
GET /api/auth/session
```

**認証**: セッション Cookie

**レスポンス（セッションあり）**
```json
{
  "data": {
    "isEditor": true,
    "guildId": "123456789"
  }
}
```

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 401 | UNAUTHORIZED | セッションなし |
