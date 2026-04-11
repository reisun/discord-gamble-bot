import { Request, Response, NextFunction } from 'express';
import { query } from '../db';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      tokenRecord?: { role: string; guild_id: string; expires_at: Date };
    }
  }
}

export function getToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return req.query.token as string | undefined;
}

export function isAdmin(req: Request): boolean {
  // tokenRecord が設定されている場合はroleで判定
  if (req.tokenRecord) {
    return req.tokenRecord.role === 'editor';
  }
  const token = getToken(req);
  return token !== undefined && token === process.env.ADMIN_TOKEN;
}

/**
 * セッションまたはアクセストークンをDBで検証する共通ヘルパー。
 * sessions テーブルを先に確認し、なければ access_tokens にフォールバック。
 */
async function resolveTokenRecord(
  rawToken: string,
): Promise<{ role: string; guild_id: string; expires_at: Date } | null> {
  // 1. sessions テーブルで検索
  const sessionRows = await query<{ role: string; guild_id: string; expires_at: Date }>(
    'SELECT role, guild_id, expires_at FROM sessions WHERE session_token = $1',
    [rawToken],
  );
  if (sessionRows.length > 0) {
    if (new Date(sessionRows[0].expires_at) < new Date()) {
      return null; // 期限切れ
    }
    return sessionRows[0];
  }

  // 2. access_tokens テーブルにフォールバック
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const rows = await query<{ role: string; guild_id: string; expires_at: Date }>(
    'SELECT role, guild_id, expires_at FROM access_tokens WHERE token_hash = $1',
    [tokenHash],
  );
  if (rows.length === 0 || new Date(rows[0].expires_at) < new Date()) {
    return null;
  }
  return rows[0];
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = getToken(req);
  if (!token) {
    res
      .status(401)
      .json({ error: { code: 'UNAUTHORIZED', message: '認証トークンが必要です' } });
    return;
  }
  // ADMIN_TOKEN（Bot→Server通信用）は常に許可
  if (token === process.env.ADMIN_TOKEN) {
    req.tokenRecord = { role: 'editor', guild_id: '*', expires_at: new Date(8640000000000000) };
    next();
    return;
  }
  // セッション → アクセストークン の順で検証
  try {
    const record = await resolveTokenRecord(token);
    if (!record) {
      res.status(401).json({ error: { code: 'TOKEN_EXPIRED', message: '再度ログインしてください' } });
      return;
    }
    if (record.role !== 'editor') {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: '管理者権限が必要です' } });
      return;
    }
    req.tokenRecord = record;
    next();
  } catch (err) {
    next(err);
  }
}

export async function requireToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const rawToken = getToken(req);
  if (!rawToken) {
    res.status(401).json({ error: { code: 'TOKEN_EXPIRED', message: '再度ログインしてください' } });
    return;
  }
  // ADMIN_TOKEN は常に有効（bot→サーバー通信用）
  if (rawToken === process.env.ADMIN_TOKEN) {
    req.tokenRecord = { role: 'editor', guild_id: '*', expires_at: new Date(8640000000000000) };
    next();
    return;
  }
  // セッション → アクセストークン の順で検証
  try {
    const record = await resolveTokenRecord(rawToken);
    if (!record) {
      res.status(401).json({ error: { code: 'TOKEN_EXPIRED', message: '再度ログインしてください' } });
      return;
    }
    req.tokenRecord = record;
    next();
  } catch (err) {
    next(err);
  }
}
