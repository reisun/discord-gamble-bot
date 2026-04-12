import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query } from '../db';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// GET /api/auth/verify
router.get('/verify', async (req: Request, res: Response, next: NextFunction) => {
  res.set('Cache-Control', 'no-store');
  try {
    const rawToken = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : (req.query.token as string | undefined);

    // トークンなし
    if (!rawToken) {
      res.json({ data: { isAdmin: false } });
      return;
    }

    // DBトークン検証
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const rows = await query<{ role: string; expires_at: Date }>(
      'SELECT role, expires_at FROM access_tokens WHERE token_hash = $1',
      [tokenHash],
    );

    if (rows.length === 0 || new Date(rows[0].expires_at) < new Date()) {
      res.status(401).json({ error: { code: 'TOKEN_EXPIRED', message: '再度 /dashboard から入ってください' } });
      return;
    }

    res.json({ data: { isAdmin: rows[0].role === 'editor' } });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/token（bot用トークン生成）
router.post('/token', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { guildId, role } = req.body as { guildId?: string; role?: string };
    if (!guildId || !role || !['editor', 'viewer'].includes(role)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'guildId と role (editor|viewer) が必要です' } });
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12時間後

    await query(
      'INSERT INTO access_tokens (token_hash, guild_id, role, expires_at) VALUES ($1, $2, $3, $4)',
      [tokenHash, guildId, role, expiresAt],
    );

    res.json({ data: { token: rawToken } });
  } catch (err) {
    next(err);
  }
});

export default router;
