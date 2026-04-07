import { Request, Response, NextFunction } from 'express';

export function getToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return req.query.token as string | undefined;
}

export function isAdmin(req: Request): boolean {
  const token = getToken(req);
  return token !== undefined && token === process.env.ADMIN_TOKEN;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = getToken(req);
  if (!token) {
    res
      .status(401)
      .json({ error: { code: 'UNAUTHORIZED', message: '認証トークンが必要です' } });
    return;
  }
  if (token !== process.env.ADMIN_TOKEN) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: '管理者権限が必要です' } });
    return;
  }
  next();
}
