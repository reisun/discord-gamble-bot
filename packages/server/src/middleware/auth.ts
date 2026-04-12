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
  if (req.tokenRecord) {
    return req.tokenRecord.role === 'editor';
  }
  return false;
}

/**
 * /internal/api 用ミドルウェア。
 * 内部リクエスト（Bot → Server 直接通信）を管理者として事前認証する。
 */
export function internalAuth(req: Request, _res: Response, next: NextFunction): void {
  req.tokenRecord = { role: 'editor', guild_id: '*', expires_at: new Date(8640000000000000) };
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  // internalAuth 等で事前認証済みの場合はスキップ
  if (req.tokenRecord) {
    if (req.tokenRecord.role !== 'editor') {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: '管理者権限が必要です' } });
      return;
    }
    next();
    return;
  }
  const token = getToken(req);
  if (!token) {
    res
      .status(401)
      .json({ error: { code: 'UNAUTHORIZED', message: '認証トークンが必要です' } });
    return;
  }
  // DBトークンを検証し、editorロールなら許可
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const rows = await query<{ role: string; guild_id: string; expires_at: Date }>(
      'SELECT role, guild_id, expires_at FROM access_tokens WHERE token_hash = $1',
      [tokenHash],
    );
    if (rows.length === 0 || new Date(rows[0].expires_at) < new Date()) {
      res.status(401).json({ error: { code: 'TOKEN_EXPIRED', message: '再度 /dashboard から入ってください' } });
      return;
    }
    if (rows[0].role !== 'editor') {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: '管理者権限が必要です' } });
      return;
    }
    req.tokenRecord = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  // internalAuth 等で事前認証済みの場合はスキップ
  if (req.tokenRecord) {
    next();
    return;
  }
  const rawToken = getToken(req);
  if (!rawToken) {
    next();
    return;
  }
  try {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const rows = await query<{ role: string; guild_id: string; expires_at: Date }>(
      'SELECT role, guild_id, expires_at FROM access_tokens WHERE token_hash = $1',
      [tokenHash],
    );
    if (rows.length > 0 && new Date(rows[0].expires_at) >= new Date()) {
      req.tokenRecord = rows[0];
    }
  } catch {
    // ignore — treat as unauthenticated
  }
  next();
}

export async function requireToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  // internalAuth 等で事前認証済みの場合はスキップ
  if (req.tokenRecord) {
    next();
    return;
  }
  const rawToken = getToken(req);
  if (!rawToken) {
    res.status(401).json({ error: { code: 'TOKEN_EXPIRED', message: '再度 /dashboard から入ってください' } });
    return;
  }
  try {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const rows = await query<{ role: string; guild_id: string; expires_at: Date }>(
      'SELECT role, guild_id, expires_at FROM access_tokens WHERE token_hash = $1',
      [tokenHash],
    );
    if (rows.length === 0 || new Date(rows[0].expires_at) < new Date()) {
      res.status(401).json({ error: { code: 'TOKEN_EXPIRED', message: '再度 /dashboard から入ってください' } });
      return;
    }
    req.tokenRecord = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}
