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

    if (!rawToken) {
      res.json({ data: { isAdmin: false } });
      return;
    }

    if (rawToken === process.env.ADMIN_TOKEN) {
      res.json({ data: { isAdmin: true } });
      return;
    }

    // sessions → access_tokens の順で検索
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

// POST /api/auth/token（Bot からトークン生成）
// discord_id を含めて発行。OAuth2 コールバックで本人確認に使用。
router.post('/token', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { guildId, role, discordId } = req.body as { guildId?: string; role?: string; discordId?: string };
    if (!guildId || !role || !['editor', 'viewer'].includes(role)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'guildId と role (editor|viewer) が必要です' } });
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12時間後

    await query(
      'INSERT INTO access_tokens (token_hash, guild_id, role, discord_id, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [tokenHash, guildId, role, discordId ?? null, expiresAt],
    );

    res.json({ data: { token: rawToken } });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/discord - Discord OAuth2 認証開始
// token クエリパラメータがある場合、state に含めてコールバックで照合する
router.get('/discord', (req: Request, res: Response) => {
  const guildId = req.query.guild_id as string | undefined;
  const redirectUri = req.query.redirect_uri as string | undefined;
  const accessToken = req.query.token as string | undefined;

  if (!guildId) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'guild_id が必要です' } });
    return;
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    res.status(500).json({ error: { code: 'CONFIG_ERROR', message: 'DISCORD_CLIENT_ID が設定されていません' } });
    return;
  }

  const callbackUrl = process.env.DISCORD_OAUTH_CALLBACK_URL!;

  const state = Buffer.from(JSON.stringify({
    guildId,
    redirectUri,
    accessToken, // Bot が発行したトークン（あれば）
  })).toString('base64url');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'identify',
    state,
  });

  res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});

// GET /api/auth/discord/callback - Discord OAuth2 コールバック
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
    let accessToken: string | undefined;
    try {
      const parsed = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
      guildId = parsed.guildId;
      redirectUri = parsed.redirectUri;
      accessToken = parsed.accessToken;
    } catch {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '不正な state パラメータ' } });
      return;
    }

    const clientId = process.env.DISCORD_CLIENT_ID!;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET!;
    const callbackUrl = process.env.DISCORD_OAUTH_CALLBACK_URL!;

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

    // 2. GET /users/@me で Discord ID を取得
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${discordAccessToken}` },
    });
    if (!userRes.ok) {
      res.status(502).json({ error: { code: 'DISCORD_ERROR', message: 'Discordユーザー情報の取得に失敗しました' } });
      return;
    }
    const userData = await userRes.json() as { id: string; username: string; global_name?: string };
    const displayName = userData.global_name || userData.username;

    // 3. トークンの本人確認
    //    accessToken がある場合: access_tokens の discord_id と OAuth2 の Discord ID を照合
    //    一致すればそのロール、不一致または無ければ拒否
    let role = 'viewer';

    if (!accessToken) {
      // トークンなし → アクセス拒否
      const webAppBaseUrl = (redirectUri || process.env.WEB_APP_BASE_URL || '').replace(/\/$/, '');
      res.redirect(`${webAppBaseUrl}/#/error?message=${encodeURIComponent('アクセスにはDiscordの /dashboard コマンドで取得したリンクが必要です')}`);
      return;
    }

    // トークンを検証
    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
    const tokenRows = await query<{ role: string; guild_id: string; discord_id: string | null; expires_at: Date }>(
      'SELECT role, guild_id, discord_id, expires_at FROM access_tokens WHERE token_hash = $1',
      [tokenHash],
    );

    if (tokenRows.length === 0 || new Date(tokenRows[0].expires_at) < new Date()) {
      const webAppBaseUrl = (redirectUri || process.env.WEB_APP_BASE_URL || '').replace(/\/$/, '');
      res.redirect(`${webAppBaseUrl}/#/error?message=${encodeURIComponent('リンクの有効期限が切れています。/dashboard コマンドで再取得してください')}`);
      return;
    }

    // discord_id が設定されていれば本人確認
    if (tokenRows[0].discord_id && tokenRows[0].discord_id !== userData.id) {
      const webAppBaseUrl = (redirectUri || process.env.WEB_APP_BASE_URL || '').replace(/\/$/, '');
      res.redirect(`${webAppBaseUrl}/#/error?message=${encodeURIComponent('このリンクは別のユーザー用です。/dashboard コマンドで自分用のリンクを取得してください')}`);
      return;
    }

    role = tokenRows[0].role;

    // 4. セッション作成
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await query(
      'INSERT INTO sessions (session_token, discord_user_id, discord_username, guild_id, role, expires_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [sessionToken, userData.id, displayName, guildId, role, expiresAt],
    );

    // 5. Web アプリにリダイレクト
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

    // sessions テーブルで検索
    const sessionRows = await query<{ role: string; guild_id: string; discord_username: string | null; expires_at: Date }>(
      'SELECT role, guild_id, discord_username, expires_at FROM sessions WHERE session_token = $1',
      [rawToken],
    );
    if (sessionRows.length > 0) {
      if (new Date(sessionRows[0].expires_at) < new Date()) {
        res.status(401).json({ error: { code: 'TOKEN_EXPIRED', message: '再度ログインしてください' } });
        return;
      }
      res.json({
        data: {
          isAdmin: sessionRows[0].role === 'editor',
          guildId: sessionRows[0].guild_id,
          discordUsername: sessionRows[0].discord_username,
        },
      });
      return;
    }

    res.status(401).json({ error: { code: 'TOKEN_EXPIRED', message: '再度ログインしてください' } });
  } catch (err) {
    next(err);
  }
});

export default router;
