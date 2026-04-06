import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../db';

const router = Router();

const EDITOR_SESSION_MS = 2 * 60 * 60 * 1000;
const VIEWER_SESSION_MS = 24 * 60 * 60 * 1000;

// GET /:guildId?token=XXX
router.get('/:guildId', async (req: Request, res: Response) => {
  const { guildId } = req.params;
  const { token } = req.query as { token?: string };

  const webAppBaseUrl = process.env.WEB_APP_BASE_URL?.replace(/\/$/, '') ?? '';
  const redirectUrl = `${webAppBaseUrl}/#/dashboard/${guildId}`;

  if (!token) {
    res.redirect(302, redirectUrl);
    return;
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const now = new Date();

  const rows = await query<{
    id: number;
    role: string;
  }>(
    `SELECT id, role FROM access_tokens
     WHERE token_hash = $1 AND guild_id = $2 AND expires_at > $3 AND used_at IS NULL
     LIMIT 1`,
    [tokenHash, guildId, now],
  );

  if (rows.length === 0) {
    res.status(400).send('トークンが無効または期限切れです。Discordで再度 /link コマンドを実行してください。');
    return;
  }

  const record = rows[0];

  // 使用済みマーク
  await query('UPDATE access_tokens SET used_at = $1 WHERE id = $2', [now, record.id]);

  // セッション発行
  const sessionMaxAge = record.role === 'editor' ? EDITOR_SESSION_MS : VIEWER_SESSION_MS;
  req.session.isEditor = record.role === 'editor';
  req.session.guildId = guildId;
  req.session.cookie.maxAge = sessionMaxAge;

  await new Promise<void>((resolve, reject) => req.session.save((err) => err ? reject(err) : resolve()));

  res.redirect(302, redirectUrl);
});

export default router;
