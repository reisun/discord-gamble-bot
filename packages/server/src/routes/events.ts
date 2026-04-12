import { Router, Request, Response, NextFunction } from 'express';
import { query, withTransaction } from '../db';
import { requireAdmin, isAdmin, optionalAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

type EventRow = {
  id: number;
  guild_id: string;
  name: string;
  is_active: boolean;
  is_published: boolean;
  initial_points: number;
  results_public: boolean;
  created_at: Date;
  updated_at: Date;
};

function formatEvent(row: EventRow) {
  return {
    id: row.id,
    guildId: row.guild_id,
    name: row.name,
    isActive: row.is_active,
    isPublished: row.is_published,
    initialPoints: row.initial_points,
    resultsPublic: row.results_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS =
  'id, guild_id, name, is_active, is_published, initial_points, results_public, created_at, updated_at';

// GET /api/events?guildId=xxx
router.get('/', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { guildId } = req.query;
    if (!guildId || typeof guildId !== 'string') {
      throw new AppError(400, 'VALIDATION_ERROR', 'guildId は必須です');
    }

    const adminUser = isAdmin(req);
    const rows = await query<EventRow>(
      adminUser
        ? `SELECT ${SELECT_COLUMNS} FROM events WHERE guild_id = $1 ORDER BY id`
        : `SELECT ${SELECT_COLUMNS} FROM events WHERE guild_id = $1 AND is_published = TRUE ORDER BY id`,
      [guildId],
    );
    res.json({ data: rows.map(formatEvent) });
  } catch (err) {
    next(err);
  }
});

// GET /api/events/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await query<EventRow>(
      `SELECT ${SELECT_COLUMNS} FROM events WHERE id = $1`,
      [req.params.id],
    );
    if (rows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'イベントが見つかりません');
    }
    res.json({ data: formatEvent(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// POST /api/events
router.post('/', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, initialPoints = 10000, resultsPublic = false, guildId } = req.body as {
      name?: string;
      initialPoints?: number;
      resultsPublic?: boolean;
      guildId?: string;
    };

    if (!guildId || typeof guildId !== 'string' || guildId.trim().length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'guildId は必須です');
    }
    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
      throw new AppError(400, 'VALIDATION_ERROR', 'name は1〜100文字で指定してください');
    }
    if (!Number.isInteger(initialPoints) || initialPoints < 1) {
      throw new AppError(400, 'VALIDATION_ERROR', 'initialPoints は1以上の整数で指定してください');
    }

    const rows = await query<EventRow>(
      `INSERT INTO events (guild_id, name, initial_points, results_public)
       VALUES ($1, $2, $3, $4)
       RETURNING ${SELECT_COLUMNS}`,
      [guildId.trim(), name.trim(), initialPoints, resultsPublic],
    );
    res.status(201).json({ data: formatEvent(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/events/:id
router.put('/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, initialPoints, resultsPublic } = req.body as {
      name?: string;
      initialPoints?: number;
      resultsPublic?: boolean;
    };

    const existing = await query<EventRow>(
      `SELECT ${SELECT_COLUMNS} FROM events WHERE id = $1`,
      [req.params.id],
    );
    if (existing.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'イベントが見つかりません');
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
        throw new AppError(400, 'VALIDATION_ERROR', 'name は1〜100文字で指定してください');
      }
    }
    if (initialPoints !== undefined) {
      if (!Number.isInteger(initialPoints) || initialPoints < 1) {
        throw new AppError(400, 'VALIDATION_ERROR', 'initialPoints は1以上の整数で指定してください');
      }
    }

    const rows = await query<EventRow>(
      `UPDATE events
       SET name = COALESCE($1, name),
           initial_points = COALESCE($2, initial_points),
           results_public = COALESCE($3, results_public),
           updated_at = NOW()
       WHERE id = $4
       RETURNING ${SELECT_COLUMNS}`,
      [name?.trim() ?? null, initialPoints ?? null, resultsPublic ?? null, req.params.id],
    );
    res.json({ data: formatEvent(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/events/:id
router.delete('/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query<{ id: number }>(
      'DELETE FROM events WHERE id = $1 RETURNING id',
      [req.params.id],
    );
    if (result.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'イベントが見つかりません');
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// PATCH /api/events/:id/activate
// 開催状態をトグルする。非開催→開催 の場合は is_published を TRUE に強制する。
// 同一ギルド内の他イベントのみ非開催にする。
router.patch(
  '/:id/activate',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await withTransaction(async (client) => {
        const check = await client.query<EventRow>(
          `SELECT id, is_active, guild_id FROM events WHERE id = $1`,
          [req.params.id],
        );
        if (check.rows.length === 0) {
          throw new AppError(404, 'NOT_FOUND', 'イベントが見つかりません');
        }

        const { is_active: currentlyActive, guild_id } = check.rows[0];

        if (currentlyActive) {
          // 開催中 → 非開催に切り替え
          const updated = await client.query<EventRow>(
            `UPDATE events SET is_active = FALSE, updated_at = NOW()
             WHERE id = $1
             RETURNING ${SELECT_COLUMNS}`,
            [req.params.id],
          );
          return updated.rows;
        } else {
          // 非開催 → 開催に切り替え（同一ギルドの他を非開催、かつ is_published を TRUE に強制）
          await client.query(
            'UPDATE events SET is_active = FALSE, updated_at = NOW() WHERE is_active = TRUE AND guild_id = $1',
            [guild_id],
          );
          const updated = await client.query<EventRow>(
            `UPDATE events SET is_active = TRUE, is_published = TRUE, updated_at = NOW()
             WHERE id = $1
             RETURNING ${SELECT_COLUMNS}`,
            [req.params.id],
          );
          return updated.rows;
        }
      });

      res.json({ data: formatEvent(rows[0]) });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/events/:id/publish
// イベントの公開/非公開を切り替える。開催中は非公開に設定不可。
router.patch(
  '/:id/publish',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { isPublished } = req.body as { isPublished?: boolean };
      if (typeof isPublished !== 'boolean') {
        throw new AppError(400, 'VALIDATION_ERROR', 'isPublished は boolean で指定してください');
      }

      const existing = await query<EventRow>(
        `SELECT ${SELECT_COLUMNS} FROM events WHERE id = $1`,
        [req.params.id],
      );
      if (existing.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'イベントが見つかりません');
      }
      if (existing[0].is_active && !isPublished) {
        throw new AppError(400, 'INVALID_OPERATION', '開催中のイベントは非公開にできません');
      }

      const rows = await query<EventRow>(
        `UPDATE events SET is_published = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING ${SELECT_COLUMNS}`,
        [isPublished, req.params.id],
      );
      res.json({ data: formatEvent(rows[0]) });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
