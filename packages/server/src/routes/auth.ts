import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query } from '../db';
import { requireEditor } from '../middleware/auth';

const router = Router();

// POST /api/auth/token - bot用: one-time token生成
router.post('/token', requireEditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { guildId, role } = req.body as { guildId?: string; role?: string };

    if (!guildId || !role || !['editor', 'viewer'].includes(role)) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'guildId と role (editor/viewer) が必要です' } });
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await query(
      'INSERT INTO access_tokens (token_hash, guild_id, role, expires_at) VALUES ($1, $2, $3, $4)',
      [tokenHash, guildId, role, expiresAt],
    );

    res.json({ data: { token: rawToken } });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/session - セッション情報を返す
router.get('/session', (req: Request, res: Response) => {
  if (req.session?.guildId) {
    res.json({ data: { isEditor: req.session.isEditor ?? false, guildId: req.session.guildId } });
  } else {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'セッションがありません' } });
  }
});

export default router;
