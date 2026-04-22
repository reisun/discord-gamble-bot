import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db';
import { requireAdmin } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

type GuildRow = {
  guild_id: string;
  guild_name: string;
  guild_icon_hash: string | null;
  admin_role_id: string | null;
  created_at: Date;
  updated_at: Date;
};

function formatGuild(row: GuildRow) {
  return {
    guildId: row.guild_id,
    guildName: row.guild_name,
    guildIconUrl: row.guild_icon_hash
      ? `https://cdn.discordapp.com/icons/${row.guild_id}/${row.guild_icon_hash}.png`
      : null,
    adminRoleId: row.admin_role_id,
  };
}

// GET /api/guilds/:guildId
router.get('/:guildId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await query<GuildRow>(
      'SELECT guild_id, guild_name, guild_icon_hash, admin_role_id, created_at, updated_at FROM guilds WHERE guild_id = $1',
      [req.params.guildId]
    );
    if (rows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'ギルドが見つかりません');
    }
    res.json({ data: formatGuild(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/guilds/:guildId  (Botがギルド情報を登録・更新する)
router.put('/:guildId', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { guildName, guildIconHash, adminRoleId } = req.body as {
      guildName?: string;
      guildIconHash?: string | null;
      adminRoleId?: string | null;
    };
    if (!guildName || typeof guildName !== 'string' || guildName.trim().length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'guildName は必須です');
    }

    const rows = await query<GuildRow>(
      `INSERT INTO guilds (guild_id, guild_name, guild_icon_hash, admin_role_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (guild_id) DO UPDATE
       SET guild_name = EXCLUDED.guild_name,
           guild_icon_hash = EXCLUDED.guild_icon_hash,
           admin_role_id = COALESCE(EXCLUDED.admin_role_id, guilds.admin_role_id),
           updated_at = NOW()
       RETURNING guild_id, guild_name, guild_icon_hash, admin_role_id, created_at, updated_at`,
      [req.params.guildId, guildName.trim(), guildIconHash ?? null, adminRoleId ?? null]
    );
    res.json({ data: formatGuild(rows[0]) });
  } catch (err) {
    next(err);
  }
});

export default router;
