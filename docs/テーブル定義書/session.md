# session テーブル

connect-pg-simple が使用するセッションストアテーブル。

## カラム定義

| カラム名 | 型 | NULL | 説明 |
|---------|-----|------|------|
| sid | varchar | NOT NULL | セッションID（主キー） |
| sess | jsonb | NOT NULL | セッションデータ（JSON） |
| expire | timestamp | NOT NULL | セッション有効期限 |

## セッションデータ構造（sess フィールド）

```json
{
  "cookie": { "maxAge": 7200000, "..." : "..." },
  "isEditor": true,
  "guildId": "123456789"
}
```

## セッション有効期限

| ロール | maxAge |
|--------|--------|
| editor | 2時間（7,200,000 ms） |
| viewer | 24時間（86,400,000 ms） |

## 備考
- このテーブルは `packages/server/migrations/1775866410000_add-session-table.ts` で作成される
