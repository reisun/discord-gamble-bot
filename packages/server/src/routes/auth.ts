import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query } from '../db';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// GET /api/auth/verify (既存 - 後方互換)
router.get('/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawToken = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : (req.query.token as string | undefined);

    // トークンなし
    if (!rawToken) {
      res.json({ data: { isAdmin: false } });
      return;
    }

    // ADMIN_TOKEN の場合
    if (rawToken === process.env.ADMIN_TOKEN) {
      res.json({ data: { isAdmin: true } });
      return;
    }

    // セッション検証
    const sessionRows = await query<{ role: string; expires_at: Date }>(
      'SELECT role, expires_at FROM sessions WHERE session_token = $1',
      [rawToken],
    );
    if (sessionRows.length > 0) {
      if (new Date(sessionRows[0].expires_at) < new Date()) {
        res.status(401).json({ error: { code: 'TOKEN_EXPIRED', message: '再度ログインしてください' } });
        return;
      }
      res.json({ data: { isAdmin: sessionRows[0].role === 'editor' } });
      return;
    }

    // DBトークン検証 (後方互換)
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const rows = await query<{ role: string; expires_at: Date }>(
      'SELECT role, expires_at FROM access_tokens WHERE token_hash = $1',
      [tokenHash],
    );

    if (rows.length === 0 || new Date(rows[0].expires_at) < new Date()) {
      res.status(401).json({ error: { code: 'TOKEN_EXPIRED', message: '再度ログインしてください' } });
      return;
    }

    res.json({ data: { isAdmin: rows[0].role === 'editor' } });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/token（bot用トークン生成 - 後方互換）
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

// GET /api/auth/discord - Discord OAuth2認証開始
router.get('/discord', (req: Request, res: Response) => {
  const guildId = req.query.guild_id as string | undefined;
  const redirectUri = req.query.redirect_uri as string | undefined;

  if (!guildId) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'guild_id が必要です' } });
    return;
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    res.status(500).json({ error: { code: 'CONFIG_ERROR', message: 'DISCORD_CLIENT_ID が設定されていません' } });
    return;
  }

  // OAuth2 callback URL (API server)
  const callbackUrl = `${req.protocol}://${req.get('host')}/api/auth/discord/callback`;

  // state にguildIdとredirect_uriを含める
  const state = Buffer.from(JSON.stringify({ guildId, redirectUri })).toString('base64url');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'identify guilds guilds.members.read',
    state,
  });

  res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});

// GET /api/auth/discord/callback - Discord OAuth2コールバック
router.get('/discord/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = req.query.code as string | undefined;
    const stateParam = req.query.state as string | undefined;

    if (!code || !stateParam) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'code と state が必要です' } });
      return;
    }

    let guildId: string;
    let redirectUri: string | undefined;
    try {
      const parsed = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
      guildId = parsed.guildId;
      redirectUri = parsed.redirectUri;
    } catch {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '不正な state パラメータ' } });
      return;
    }

    const clientId = process.env.DISCORD_CLIENT_ID!;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET!;
    const callbackUrl = `${req.protocol}://${req.get('host')}/api/auth/discord/callback`;

    // 1. Exchange code for Discord access token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('Discord token exchange failed:', errBody);
      res.status(502).json({ error: { code: 'DISCORD_ERROR', message: 'Discord認証に失敗しました' } });
      return;
    }

    const tokenData = await tokenRes.json() as { access_token: string; token_type: string };
    const discordAccessToken = tokenData.access_token;

    // 2. GET /users/@me
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${discordAccessToken}` },
    });
    if (!userRes.ok) {
      res.status(502).json({ error: { code: 'DISCORD_ERROR', message: 'Discordユーザー情報の取得に失敗しました' } });
      return;
    }
    const userData = await userRes.json() as { id: string; username: string; global_name?: string };

    // 3. GET /users/@me/guilds to check membership
    const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${discordAccessToken}` },
    });
    if (!guildsRes.ok) {
      res.status(502).json({ error: { code: 'DISCORD_ERROR', message: 'Discordギルド情報の取得に失敗しました' } });
      return;
    }
    const guilds = await guildsRes.json() as { id: string }[];

    // 4. Check if user is member of the specified guild
    const isMember = guilds.some((g) => g.id === guildId);
    if (!isMember) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'このサーバーのメンバーではありません' } });
      return;
    }

    // 5. Check if user has admin role in that guild
    let role = 'viewer';
    try {
      const memberRes = await fetch(`https://discord.com/api/users/@me/guilds/${guildId}/member`, {
        headers: { Authorization: `Bearer ${discordAccessToken}` },
      });
      if (memberRes.ok) {
        const memberData = await memberRes.json() as { roles: string[] };
        const adminRoleIds = (process.env.DISCORD_ADMIN_ROLE_ID || '').split(',').map((r) => r.trim()).filter(Boolean);
        const hasAdminRole = memberData.roles.some((r) => adminRoleIds.includes(r));
        if (hasAdminRole) {
          role = 'editor';
        }
      }
    } catch (err) {
      console.error('Failed to check member roles:', err);
      // ロール確認失敗時はviewerのまま
    }

    // 6. Create session in sessions table (48h expiry)
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const displayName = userData.global_name || userData.username;

    await query(
      'INSERT INTO sessions (session_token, discord_user_id, discord_username, guild_id, role, expires_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [sessionToken, userData.id, displayName, guildId, role, expiresAt],
    );

    // 7. Redirect to web app with session token in hash
    const webAppBaseUrl = (redirectUri || process.env.WEB_APP_BASE_URL || '').replace(/\/$/, '');
    const finalUrl = `${webAppBaseUrl}/#/dashboard/${guildId}?session=${sessionToken}`;
    res.redirect(finalUrl);
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/session - セッション検証
router.get('/session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawToken = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : (req.query.session as string | undefined);

    if (!rawToken) {
      res.status(401).json({ error: { code: 'TOKEN_EXPIRED', message: 'セッションが必要です' } });
      return;
    }

    // ADMIN_TOKEN の場合
    if (rawToken === process.env.ADMIN_TOKEN) {
      res.json({ data: { isAdmin: true, guildId: '*', discordUsername: 'Admin' } });
      return;
    }

    const rows = await query<{ role: string; guild_id: string; discord_username: string | null; expires_at: Date }>(
      'SELECT role, guild_id, discord_username, expires_at FROM sessions WHERE session_token = $1',
      [rawToken],
    );

    if (rows.length === 0 || new Date(rows[0].expires_at) < new Date()) {
      res.status(401).json({ error: { code: 'TOKEN_EXPIRED', message: '再度ログインしてください' } });
      return;
    }

    res.json({
      data: {
        isAdmin: rows[0].role === 'editor',
        guildId: rows[0].guild_id,
        discordUsername: rows[0].discord_username,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
