import { Router, Request, Response, NextFunction } from 'express';
import { PoolClient } from 'pg';
import { query, withTransaction } from '../db';
import { requireAdmin, isAdmin } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router({ mergeParams: true });

type GameRow = {
  id: number;
  event_id: number;
  title: string;
  description: string | null;
  deadline: Date;
  is_published: boolean;
  status: string;
  bet_type: string;
  required_selections: number | null;
  result_symbols: string | null;
  created_at: Date;
  updated_at: Date;
};

type BetOptionRow = {
  id: number;
  game_id: number;
  symbol: string;
  label: string;
  order: number;
};

const VALID_BET_TYPES = ['single', 'multi_unordered', 'multi_ordered', 'multi_ordered_dup'];
const SYMBOL_REGEX = /^[A-Z1-9]$/;

/** deadlineに基づいてstatusを動的に計算する */
function computeStatus(row: GameRow): 'open' | 'closed' | 'finished' {
  if (row.status === 'finished') return 'finished';
  if (new Date(row.deadline) <= new Date()) return 'closed';
  return 'open';
}

function formatGame(row: GameRow, betOptions: BetOptionRow[]) {
  return {
    id: row.id,
    eventId: row.event_id,
    title: row.title,
    description: row.description,
    deadline: row.deadline,
    isPublished: row.is_published,
    status: computeStatus(row),
    betType: row.bet_type,
    requiredSelections: row.required_selections,
    resultSymbols: row.result_symbols,
    betOptions: betOptions.map((o) => ({
      id: o.id,
      symbol: o.symbol,
      label: o.label,
      order: o.order,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchGameWithOptions(
  client: PoolClient,
  gameId: number | string,
): Promise<{ game: GameRow; options: BetOptionRow[] } | null> {
  const gameRows = await client.query<GameRow>(
    'SELECT * FROM games WHERE id = $1',
    [gameId],
  );
  if (gameRows.rows.length === 0) return null;

  const optionRows = await client.query<BetOptionRow>(
    'SELECT id, game_id, symbol, label, "order" FROM bet_options WHERE game_id = $1 ORDER BY "order"',
    [gameId],
  );
  return { game: gameRows.rows[0], options: optionRows.rows };
}

function validateBetOptions(
  betOptions: { symbol: string; label: string }[],
  betType: string,
  requiredSelections: number | null,
): void {
  if (!Array.isArray(betOptions) || betOptions.length < 2) {
    throw new AppError(400, 'VALIDATION_ERROR', '賭け項目は2つ以上必要です');
  }

  const symbols = new Set<string>();
  for (const opt of betOptions) {
    if (!opt.symbol || !SYMBOL_REGEX.test(opt.symbol)) {
      throw new AppError(400, 'VALIDATION_ERROR', `記号は半角英字(A〜Z)または半角数字(1〜9)で指定してください: ${opt.symbol}`);
    }
    if (symbols.has(opt.symbol)) {
      throw new AppError(400, 'VALIDATION_ERROR', `記号が重複しています: ${opt.symbol}`);
    }
    symbols.add(opt.symbol);

    if (!opt.label || typeof opt.label !== 'string' || opt.label.length === 0 || opt.label.length > 50) {
      throw new AppError(400, 'VALIDATION_ERROR', '項目名は1〜50文字で指定してください');
    }
  }

  if (betType !== 'single' && requiredSelections !== null) {
    if (betOptions.length < requiredSelections) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `賭け項目数(${betOptions.length})は選択数(${requiredSelections})以上必要です`,
      );
    }
  }
}

// GET /api/events/:eventId/games
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;
    const adminMode = isAdmin(req);
    const includeUnpublished = adminMode && req.query.includeUnpublished === 'true';

    const whereClause = includeUnpublished
      ? 'WHERE g.event_id = $1'
      : 'WHERE g.event_id = $1 AND g.is_published = TRUE';

    const gameRows = await query<GameRow>(
      `SELECT * FROM games g ${whereClause} ORDER BY g.id`,
      [eventId],
    );

    if (gameRows.length === 0) {
      const eventExists = await query<{ id: number }>(
        'SELECT id FROM events WHERE id = $1',
        [eventId],
      );
      if (eventExists.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'イベントが見つかりません');
      }
      res.json({ data: [] });
      return;
    }

    const gameIds = gameRows.map((g) => g.id);
    const optionRows = await query<BetOptionRow>(
      `SELECT id, game_id, symbol, label, "order" FROM bet_options WHERE game_id = ANY($1) ORDER BY game_id, "order"`,
      [gameIds],
    );

    const optionsByGame = new Map<number, BetOptionRow[]>();
    for (const opt of optionRows) {
      if (!optionsByGame.has(opt.game_id)) optionsByGame.set(opt.game_id, []);
      optionsByGame.get(opt.game_id)!.push(opt);
    }

    res.json({ data: gameRows.map((g) => formatGame(g, optionsByGame.get(g.id) ?? [])) });
  } catch (err) {
    next(err);
  }
});

// GET /api/games/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gameRows = await query<GameRow>('SELECT * FROM games WHERE id = $1', [req.params.id]);
    if (gameRows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'ゲームが見つかりません');
    }

    const optionRows = await query<BetOptionRow>(
      'SELECT id, game_id, symbol, label, "order" FROM bet_options WHERE game_id = $1 ORDER BY "order"',
      [req.params.id],
    );
    res.json({ data: formatGame(gameRows[0], optionRows) });
  } catch (err) {
    next(err);
  }
});

// POST /api/events/:eventId/games
router.post('/', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;
    const {
      title,
      description,
      deadline,
      betType = 'single',
      requiredSelections = null,
      betOptions,
    } = req.body as {
      title?: string;
      description?: string;
      deadline?: string;
      betType?: string;
      requiredSelections?: number | null;
      betOptions?: { symbol: string; label: string }[];
    };

    // Validate
    const eventExists = await query<{ id: number }>('SELECT id FROM events WHERE id = $1', [eventId]);
    if (eventExists.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'イベントが見つかりません');
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0 || title.length > 100) {
      throw new AppError(400, 'VALIDATION_ERROR', 'title は1〜100文字で指定してください');
    }
    if (description !== undefined && description !== null && description.length > 500) {
      throw new AppError(400, 'VALIDATION_ERROR', 'description は500文字以内で指定してください');
    }
    if (!deadline) {
      throw new AppError(400, 'VALIDATION_ERROR', 'deadline は必須です');
    }
    const deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate.getTime()) || deadlineDate <= new Date()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'deadline は現在時刻より未来の日時を指定してください');
    }
    if (!VALID_BET_TYPES.includes(betType)) {
      throw new AppError(400, 'VALIDATION_ERROR', `betType は ${VALID_BET_TYPES.join(' / ')} のいずれかを指定してください`);
    }
    if (betType === 'single') {
      if (requiredSelections !== null && requiredSelections !== undefined) {
        throw new AppError(400, 'VALIDATION_ERROR', 'betType が single の場合 requiredSelections は不要です');
      }
    } else {
      if (!requiredSelections || !Number.isInteger(requiredSelections) || requiredSelections < 2) {
        throw new AppError(400, 'VALIDATION_ERROR', 'requiredSelections は2以上の整数で指定してください');
      }
    }
    validateBetOptions(betOptions ?? [], betType, requiredSelections ?? null);

    const result = await withTransaction(async (client) => {
      const gameRows = await client.query<GameRow>(
        `INSERT INTO games (event_id, title, description, deadline, bet_type, required_selections)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [eventId, title.trim(), description ?? null, deadlineDate, betType, requiredSelections ?? null],
      );
      const game = gameRows.rows[0];

      for (let i = 0; i < (betOptions ?? []).length; i++) {
        const opt = betOptions![i];
        await client.query(
          'INSERT INTO bet_options (game_id, symbol, label, "order") VALUES ($1, $2, $3, $4)',
          [game.id, opt.symbol, opt.label, i + 1],
        );
      }

      const optRows = await client.query<BetOptionRow>(
        'SELECT id, game_id, symbol, label, "order" FROM bet_options WHERE game_id = $1 ORDER BY "order"',
        [game.id],
      );
      return { game, options: optRows.rows };
    });

    res.status(201).json({ data: formatGame(result.game, result.options) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/games/:id
router.put('/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      title,
      description,
      deadline,
      betType,
      requiredSelections,
      betOptions,
    } = req.body as {
      title?: string;
      description?: string;
      deadline?: string;
      betType?: string;
      requiredSelections?: number | null;
      betOptions?: { symbol: string; label: string }[];
    };

    const result = await withTransaction(async (client) => {
      const found = await fetchGameWithOptions(client, req.params.id);
      if (!found) throw new AppError(404, 'NOT_FOUND', 'ゲームが見つかりません');

      const { game, options: currentOptions } = found;
      const isPublished = game.is_published;

      // Published game restriction check
      if (isPublished) {
        const restricted = ['deadline', 'betType', 'requiredSelections'];
        for (const field of restricted) {
          if (req.body[field] !== undefined) {
            throw new AppError(
              409,
              'CONFLICT',
              `公開済みゲームでは ${field} は変更できません`,
            );
          }
        }
        if (betOptions !== undefined) {
          // Only label changes allowed - check for structural changes
          if (betOptions.length !== currentOptions.length) {
            throw new AppError(409, 'CONFLICT', '公開済みゲームでは賭け項目の追加・削除はできません');
          }
          for (let i = 0; i < betOptions.length; i++) {
            if (betOptions[i].symbol !== currentOptions[i].symbol) {
              throw new AppError(409, 'CONFLICT', '公開済みゲームでは賭け項目の記号は変更できません');
            }
          }
        }
      } else {
        // Full validation for unpublished
        if (deadline !== undefined) {
          const d = new Date(deadline);
          if (isNaN(d.getTime()) || d <= new Date()) {
            throw new AppError(400, 'VALIDATION_ERROR', 'deadline は現在時刻より未来の日時を指定してください');
          }
        }
        if (betType !== undefined && !VALID_BET_TYPES.includes(betType)) {
          throw new AppError(400, 'VALIDATION_ERROR', `betType は ${VALID_BET_TYPES.join(' / ')} のいずれかを指定してください`);
        }
        const effectiveBetType = betType ?? game.bet_type;
        const effectiveRequiredSelections = requiredSelections !== undefined ? requiredSelections : game.required_selections;
        if (effectiveBetType !== 'single' && (effectiveRequiredSelections === null || effectiveRequiredSelections < 2)) {
          throw new AppError(400, 'VALIDATION_ERROR', 'requiredSelections は2以上の整数で指定してください');
        }
        if (betOptions !== undefined) {
          validateBetOptions(betOptions, effectiveBetType, effectiveRequiredSelections);
        }
      }

      if (title !== undefined) {
        if (typeof title !== 'string' || title.trim().length === 0 || title.length > 100) {
          throw new AppError(400, 'VALIDATION_ERROR', 'title は1〜100文字で指定してください');
        }
      }
      if (description !== undefined && description !== null && description.length > 500) {
        throw new AppError(400, 'VALIDATION_ERROR', 'description は500文字以内で指定してください');
      }

      const updatedGame = await client.query<GameRow>(
        `UPDATE games
         SET title = COALESCE($1, title),
             description = CASE WHEN $2::text IS NOT NULL THEN $2 ELSE description END,
             deadline = COALESCE($3, deadline),
             bet_type = COALESCE($4, bet_type),
             required_selections = CASE WHEN $5::integer IS NOT NULL THEN $5 ELSE required_selections END,
             updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [
          title?.trim() ?? null,
          description !== undefined ? (description ?? null) : null,
          deadline ? new Date(deadline) : null,
          betType ?? null,
          requiredSelections !== undefined ? (requiredSelections ?? null) : null,
          req.params.id,
        ],
      );

      let updatedOptions: BetOptionRow[] = currentOptions;

      if (betOptions !== undefined) {
        if (isPublished) {
          // Only update labels
          for (const opt of betOptions) {
            await client.query(
              'UPDATE bet_options SET label = $1 WHERE game_id = $2 AND symbol = $3',
              [opt.label, req.params.id, opt.symbol],
            );
          }
        } else {
          // Full replacement
          await client.query('DELETE FROM bet_options WHERE game_id = $1', [req.params.id]);
          for (let i = 0; i < betOptions.length; i++) {
            await client.query(
              'INSERT INTO bet_options (game_id, symbol, label, "order") VALUES ($1, $2, $3, $4)',
              [req.params.id, betOptions[i].symbol, betOptions[i].label, i + 1],
            );
          }
        }
        const optRows = await client.query<BetOptionRow>(
          'SELECT id, game_id, symbol, label, "order" FROM bet_options WHERE game_id = $1 ORDER BY "order"',
          [req.params.id],
        );
        updatedOptions = optRows.rows;
      }

      return { game: updatedGame.rows[0], options: updatedOptions };
    });

    res.json({ data: formatGame(result.game, result.options) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/games/:id
router.delete('/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query<{ id: number }>(
      'DELETE FROM games WHERE id = $1 RETURNING id',
      [req.params.id],
    );
    if (result.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'ゲームが見つかりません');
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// PATCH /api/games/:id/publish
router.patch(
  '/:id/publish',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { isPublished } = req.body as { isPublished?: boolean };
      if (typeof isPublished !== 'boolean') {
        throw new AppError(400, 'VALIDATION_ERROR', 'isPublished は boolean で指定してください');
      }

      const result = await withTransaction(async (client) => {
        const found = await fetchGameWithOptions(client, req.params.id);
        if (!found) throw new AppError(404, 'NOT_FOUND', 'ゲームが見つかりません');

        const updated = await client.query<GameRow>(
          'UPDATE games SET is_published = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
          [isPublished, req.params.id],
        );
        return { game: updated.rows[0], options: found.options };
      });

      res.json({ data: formatGame(result.game, result.options) });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/games/:id/result
router.patch(
  '/:id/result',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { resultSymbols } = req.body as { resultSymbols?: string };

      if (!resultSymbols || typeof resultSymbols !== 'string') {
        throw new AppError(400, 'VALIDATION_ERROR', 'resultSymbols は必須です');
      }

      const result = await withTransaction(async (client) => {
        const found = await fetchGameWithOptions(client, req.params.id);
        if (!found) throw new AppError(404, 'NOT_FOUND', 'ゲームが見つかりません');

        const { game, options } = found;
        const effectiveStatus = computeStatus(game);

        if (effectiveStatus !== 'closed' && effectiveStatus !== 'finished') {
          throw new AppError(409, 'CONFLICT', '結果確定は締め切り後（closed / finished）のゲームのみ可能です');
        }

        // Validate resultSymbols per betType
        const symbolSet = new Set(options.map((o) => o.symbol));
        const chars = resultSymbols.split('');

        for (const ch of chars) {
          if (!symbolSet.has(ch)) {
            throw new AppError(400, 'VALIDATION_ERROR', `記号 ${ch} はこのゲームに存在しません`);
          }
        }

        let normalized = resultSymbols;
        if (game.bet_type === 'single') {
          if (chars.length !== 1) throw new AppError(400, 'VALIDATION_ERROR', 'single方式では記号を1つ指定してください');
        } else if (game.required_selections !== null) {
          if (chars.length !== game.required_selections) {
            throw new AppError(400, 'VALIDATION_ERROR', `選択数は${game.required_selections}文字にしてください`);
          }
          if (game.bet_type !== 'multi_ordered_dup') {
            const uniqueChars = new Set(chars);
            if (uniqueChars.size !== chars.length) {
              throw new AppError(400, 'VALIDATION_ERROR', '記号の重複は許可されていません');
            }
          }
          if (game.bet_type === 'multi_unordered') {
            normalized = chars.sort().join('');
          }
        }

        // Delete old game_result entries for idempotency
        await client.query(
          "DELETE FROM point_history WHERE game_id = $1 AND reason = 'game_result'",
          [req.params.id],
        );

        // Update game result
        const updated = await client.query<GameRow>(
          "UPDATE games SET result_symbols = $1, status = 'finished', updated_at = NOW() WHERE id = $2 RETURNING *",
          [normalized, req.params.id],
        );
        const updatedGame = updated.rows[0];

        // Calculate parimutuel odds for winners
        const betsRows = await client.query<{
          id: number;
          user_id: number;
          game_id: number;
          event_id: number;
          selected_symbols: string;
          amount: number;
          is_debt: boolean;
        }>(
          `SELECT b.id, b.user_id, b.game_id, g.event_id, b.selected_symbols, b.amount, b.is_debt
           FROM bets b
           JOIN games g ON g.id = b.game_id
           WHERE b.game_id = $1`,
          [req.params.id],
        );

        if (betsRows.rows.length > 0) {
          const totalPoints = betsRows.rows.reduce((sum, b) => sum + b.amount, 0);
          const winnerBets = betsRows.rows.filter((b) => b.selected_symbols === normalized);
          const winnerTotalPoints = winnerBets.reduce((sum, b) => sum + b.amount, 0);

          if (winnerTotalPoints > 0) {
            const odds = totalPoints / winnerTotalPoints;
            for (const bet of winnerBets) {
              const payout = Math.floor(bet.amount * odds);
              await client.query(
                `INSERT INTO point_history (user_id, event_id, game_id, change_amount, reason)
                 VALUES ($1, $2, $3, $4, 'game_result')`,
                [bet.user_id, bet.event_id, req.params.id, payout],
              );
            }
          }
        }

        return { game: updatedGame, options };
      });

      res.json({ data: formatGame(result.game, result.options) });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
