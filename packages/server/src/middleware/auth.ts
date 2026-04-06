import { Request, Response, NextFunction } from 'express';

export function getToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return undefined;
}

export function isEditor(req: Request): boolean {
  if (req.session?.isEditor !== undefined) {
    return req.session.isEditor;
  }
  const token = getToken(req);
  return token !== undefined && token === process.env.ADMIN_TOKEN;
}

export function requireEditor(req: Request, res: Response, next: NextFunction): void {
  if (isEditor(req)) {
    next();
    return;
  }
  if (!req.session?.guildId && !getToken(req)) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '認証が必要です' } });
    return;
  }
  res.status(403).json({ error: { code: 'FORBIDDEN', message: '編集権限が必要です' } });
}

// 後方互換エイリアス
export const isAdmin = isEditor;
export const requireAdmin = requireEditor;
