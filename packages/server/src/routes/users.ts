import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db';
import { isAdmin, requireToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

type UserRow = {
  id: number;
  discord_id: string;
  discord_name: string;
  discord_avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
};

type PointsResult = {
  user_id: number;
  current_points: number;
};

type DebtResult = {
  user_id: number;
  total_debt: number;
};

/** イベント内の現在ポイントをユーザーIDのリストで一括取得 */
async function fetchPoints(
  userIds: number[],
  eventId: number | string,
): Promise<Map<number, number>> {
  if (userIds.length === 0) return new Map();

  const rows = await query<PointsResult>(
    `SELECT ph.user_id,
            (e.initial_points + COALESCE(SUM(ph.change_amount), 0))::integer AS current_points
     FROM events e
     LEFT JOIN point_history ph ON ph.user_id = ANY($1) AND ph.event_id = e.id
     WHERE e.id = $2
     GROUP BY ph.user_id, e.initial_points`,
    [userIds, eventId],
  );

  const map = new Map<number, number>();

  // デフォルト値: ポイント履歴のないユーザーは initial_points を返す
  // fetchInitialPoints で補完
  for (const row of rows) {
    if (row.user_id !== null) {
      map.set(row.user_id, row.current_points);
    }
  }
  return map;
}

/** イベントの initial_points を取得 */
async function fetchInitialPoints(eventId: number | string): Promise<number> {
  const rows = await query<{ initial_points: number }>(
    'SELECT initial_points FROM events WHERE id = $1',
    [eventId],
  );
  return rows[0]?.initial_points ?? 0;
}

/** イベント内の借金総額をユーザーIDのリストで一括取得 */
async function fetchDebts(
  userIds: number[],
  eventId: number | string,
): Promise<Map<number, number>> {
  if (userIds.length === 0) return new Map();

  const rows = await query<DebtResult>(
    `SELECT user_id, COALESCE(SUM(change_amount), 0)::integer AS total_debt
     FROM debt_history
     WHERE user_id = ANY($1) AND event_id = $2
     GROUP BY user_id`,
    [userIds, eventId],
  );
  return new Map(rows.map((r) => [r.user_id, r.total_debt]));
}

/** 開催中イベントIDを取得 */
async function getActiveEventId(): Promise<number | null> {
  const rows = await query<{ id: number }>(
    'SELECT id FROM events WHERE is_active = TRUE LIMIT 1',
  );
  return rows[0]?.id ?? null;
}

// GET /api/users
router.get('/', requireToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.query.eventId as string | undefined;
    if (!eventId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'eventId は必須です');
    }

    const eventExists = await query<{ id: number }>('SELECT id FROM events WHERE id = $1', [eventId]);
    if (eventExists.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'イベントが見つかりません');
    }

    const users = await query<UserRow>(
      'SELECT id, discord_id, discord_name, discord_avatar_url, created_at, updated_at FROM users ORDER BY id',
    );
    const userIds = users.map((u) => u.id);
    const initialPoints = await fetchInitialPoints(eventId as string);
    const pointsMap = await fetchPoints(userIds, eventId as string);
    const adminMode = isAdmin(req);
    const debtsMap = adminMode ? await fetchDebts(userIds, eventId as string) : new Map<number, number>();

    const data = users.map((u) => {
      const points = pointsMap.get(u.id) ?? initialPoints;
      const base: Record<string, unknown> = {
        id: u.id,
        discordId: u.discord_id,
        discordName: u.discord_name,
        avatarUrl: u.discord_avatar_url ?? null,
        points,
      };
      if (adminMode) {
        base.debt = debtsMap.get(u.id) ?? 0;
      }
      return base;
    });

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/discord/:discordId  ← must be before /:id
router.get('/discord/:discordId', requireToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await query<UserRow>(
      'SELECT id, discord_id, discord_name, discord_avatar_url, created_at, updated_at FROM users WHERE discord_id = $1',
      [req.params.discordId],
    );
    if (users.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'ユーザーが見つかりません');
    }
    const user = users[0];

    const eventId = (req.query.eventId as string | undefined) ?? (await getActiveEventId());
    if (!eventId) {
      throw new AppError(404, 'NOT_FOUND', '開催中のイベントが見つかりません');
    }

    const initialPoints = await fetchInitialPoints(eventId);
    const pointsMap = await fetchPoints([user.id], eventId);
    const adminMode = isAdmin(req);

    const base: Record<string, unknown> = {
      id: user.id,
      discordId: user.discord_id,
      discordName: user.discord_name,
      avatarUrl: user.discord_avatar_url ?? null,
      points: pointsMap.get(user.id) ?? initialPoints,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
    if (adminMode) {
      const debtsMap = await fetchDebts([user.id], eventId);
      base.debt = debtsMap.get(user.id) ?? 0;
    }

    res.json({ data: base });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id
router.get('/:id', requireToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await query<UserRow>(
      'SELECT id, discord_id, discord_name, discord_avatar_url, created_at, updated_at FROM users WHERE id = $1',
      [req.params.id],
    );
    if (users.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'ユーザーが見つかりません');
    }
    const user = users[0];

    const eventId = (req.query.eventId as string | undefined) ?? (await getActiveEventId());
    if (!eventId) {
      throw new AppError(404, 'NOT_FOUND', '開催中のイベントが見つかりません');
    }

    const initialPoints = await fetchInitialPoints(eventId);
    const pointsMap = await fetchPoints([user.id], eventId);
    const adminMode = isAdmin(req);

    const base: Record<string, unknown> = {
      id: user.id,
      discordId: user.discord_id,
      discordName: user.discord_name,
      avatarUrl: user.discord_avatar_url ?? null,
      points: pointsMap.get(user.id) ?? initialPoints,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
    if (adminMode) {
      const debtsMap = await fetchDebts([user.id], eventId);
      base.debt = debtsMap.get(user.id) ?? 0;
    }

    res.json({ data: base });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id/point-history
router.get('/:id/point-history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await query<{ id: number }>('SELECT id FROM users WHERE id = $1', [req.params.id]);
    if (users.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'ユーザーが見つかりません');
    }

    const rows = await query<{
      id: number;
      game_id: number | null;
      game_title: string | null;
      change_amount: number;
      reason: string;
      created_at: Date;
    }>(
      `SELECT ph.id, ph.game_id, g.title AS game_title, ph.change_amount, ph.reason, ph.created_at
       FROM point_history ph
       LEFT JOIN games g ON g.id = ph.game_id
       WHERE ph.user_id = $1
       ORDER BY ph.created_at DESC`,
      [req.params.id],
    );

    res.json({
      data: rows.map((r) => ({
        id: r.id,
        gameId: r.game_id,
        gameTitle: r.game_title,
        changeAmount: r.change_amount,
        reason: r.reason,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id/event-bets/:eventId
router.get('/:id/event-bets/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, eventId } = req.params;

    const users = await query<{ id: number }>('SELECT id FROM users WHERE id = $1', [id]);
    if (users.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'ユーザーが見つかりません');
    }

    const eventRows = await query<{ id: number; name: string; initial_points: number }>(
      'SELECT id, name, initial_points FROM events WHERE id = $1',
      [eventId],
    );
    if (eventRows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'イベントが見つかりません');
    }
    const event = eventRows[0];

    // Current points
    const phSum = await query<{ total: number }>(
      `SELECT COALESCE(SUM(change_amount), 0)::integer AS total
       FROM point_history WHERE user_id = $1 AND event_id = $2`,
      [id, eventId],
    );
    const currentPoints = event.initial_points + (phSum[0]?.total ?? 0);

    // Bets for this user in this event
    const betRows = await query<{
      game_id: number;
      game_title: string;
      game_status: string;
      game_deadline: Date;
      bet_type: string;
      required_selections: number | null;
      result_symbols: string | null;
      selected_symbols: string;
      amount: number;
      is_debt: boolean;
    }>(
      `SELECT b.game_id, g.title AS game_title, g.status AS game_status, g.deadline AS game_deadline,
              g.bet_type, g.required_selections, g.result_symbols,
              b.selected_symbols, b.amount, b.is_debt
       FROM bets b
       JOIN games g ON g.id = b.game_id
       WHERE b.user_id = $1 AND g.event_id = $2
       ORDER BY g.id`,
      [id, eventId],
    );

    // Bet options (labels) for all games in one query
    const gameIds = [...new Set(betRows.map((b) => b.game_id))];
    const optRows =
      gameIds.length > 0
        ? await query<{ game_id: number; symbol: string; label: string }>(
            'SELECT game_id, symbol, label FROM bet_options WHERE game_id = ANY($1)',
            [gameIds],
          )
        : [];

    const optsByGame = new Map<number, Map<string, string>>();
    for (const opt of optRows) {
      if (!optsByGame.has(opt.game_id)) optsByGame.set(opt.game_id, new Map());
      optsByGame.get(opt.game_id)!.set(opt.symbol, opt.label);
    }

    // Current bets aggregate for odds calculation
    const allBetsRows =
      gameIds.length > 0
        ? await query<{ game_id: number; selected_symbols: string; amount: number }>(
            'SELECT game_id, selected_symbols, amount FROM bets WHERE game_id = ANY($1)',
            [gameIds],
          )
        : [];

    const betsByGame = new Map<number, typeof allBetsRows>();
    for (const b of allBetsRows) {
      if (!betsByGame.has(b.game_id)) betsByGame.set(b.game_id, []);
      betsByGame.get(b.game_id)!.push(b);
    }

    // point_history for game_result per game
    const phGameRows =
      gameIds.length > 0
        ? await query<{ game_id: number; change_amount: number }>(
            `SELECT game_id, SUM(change_amount)::integer AS change_amount
             FROM point_history WHERE user_id = $1 AND game_id = ANY($2) AND reason = 'game_result'
             GROUP BY game_id`,
            [id, gameIds],
          )
        : [];
    const phByGame = new Map(phGameRows.map((r) => [r.game_id, r.change_amount]));

    const computeGameEffectiveStatus = (row: { game_status: string; game_deadline: Date }) => {
      if (row.game_status === 'finished') return 'finished';
      if (new Date(row.game_deadline) <= new Date()) return 'closed';
      return 'open';
    };

    const bets = betRows.map((b) => {
      const effectiveStatus = computeGameEffectiveStatus(b);
      const isFinished = effectiveStatus === 'finished';
      const optMap = optsByGame.get(b.game_id) ?? new Map<string, string>();
      const selectedLabels = b.selected_symbols.split('').map((s) => optMap.get(s) ?? s);

      let odds: number | null = null;
      let estimatedPayout: number | null = null;
      let result: 'win' | 'lose' | null = null;
      let pointChange: number | null = null;

      if (!isFinished) {
        const gameBets = betsByGame.get(b.game_id) ?? [];
        const totalPts = gameBets.reduce((s, x) => s + x.amount, 0);
        const combPts = gameBets
          .filter((x) => x.selected_symbols === b.selected_symbols)
          .reduce((s, x) => s + x.amount, 0);
        if (combPts > 0 && totalPts > 0) {
          odds = Math.round((totalPts / combPts) * 100) / 100;
          estimatedPayout = Math.floor(b.amount * odds);
        }
      } else {
        result = b.selected_symbols === b.result_symbols ? 'win' : 'lose';
        pointChange = result === 'win' ? (phByGame.get(b.game_id) ?? 0) : 0;
      }

      return {
        gameId: b.game_id,
        gameTitle: b.game_title,
        gameStatus: effectiveStatus,
        betType: b.bet_type,
        requiredSelections: b.required_selections,
        deadline: b.game_deadline,
        selectedSymbols: b.selected_symbols,
        selectedLabels,
        amount: b.amount,
        isDebt: b.is_debt,
        odds,
        estimatedPayout,
        result,
        pointChange,
      };
    });

    res.json({
      data: {
        eventId: event.id,
        eventName: event.name,
        currentPoints,
        bets,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id/event-results/:eventId
router.get(
  '/:id/event-results/:eventId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, eventId } = req.params;
      const adminMode = isAdmin(req);

      const users = await query<{ id: number }>('SELECT id FROM users WHERE id = $1', [id]);
      if (users.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'ユーザーが見つかりません');
      }

      const eventRows = await query<{ id: number; initial_points: number; results_public: boolean }>(
        'SELECT id, initial_points, results_public FROM events WHERE id = $1',
        [eventId],
      );
      if (eventRows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'イベントが見つかりません');
      }
      const event = eventRows[0];

      if (!adminMode && !event.results_public) {
        throw new AppError(403, 'FORBIDDEN', 'このイベントのユーザー結果は非公開です');
      }

      // Current points
      const phSum = await query<{ total: number }>(
        `SELECT COALESCE(SUM(change_amount), 0)::integer AS total
         FROM point_history WHERE user_id = $1 AND event_id = $2`,
        [id, eventId],
      );
      const totalPointChange = phSum[0]?.total ?? 0;
      const finalPoints = event.initial_points + totalPointChange;

      // Total debt
      const dhSum = await query<{ total: number }>(
        `SELECT COALESCE(SUM(change_amount), 0)::integer AS total
         FROM debt_history WHERE user_id = $1 AND event_id = $2`,
        [id, eventId],
      );
      const totalDebt = dhSum[0]?.total ?? 0;
      const totalAssets = finalPoints - totalDebt;
      const totalAssetsChange = totalAssets - event.initial_points;

      // Games with bets
      const betRows = await query<{
        game_id: number;
        game_title: string;
        game_status: string;
        game_deadline: Date;
        bet_type: string;
        required_selections: number | null;
        result_symbols: string | null;
        selected_symbols: string;
        amount: number;
        is_debt: boolean;
      }>(
        `SELECT b.game_id, g.title AS game_title, g.status AS game_status, g.deadline AS game_deadline,
                g.bet_type, g.required_selections, g.result_symbols,
                b.selected_symbols, b.amount, b.is_debt
         FROM bets b
         JOIN games g ON g.id = b.game_id
         WHERE b.user_id = $1 AND g.event_id = $2 AND g.status = 'finished'
         ORDER BY g.id`,
        [id, eventId],
      );

      const gameIds = [...new Set(betRows.map((b) => b.game_id))];
      const optRows =
        gameIds.length > 0
          ? await query<{ game_id: number; symbol: string; label: string }>(
              'SELECT game_id, symbol, label FROM bet_options WHERE game_id = ANY($1)',
              [gameIds],
            )
          : [];

      const optsByGame = new Map<number, Map<string, string>>();
      for (const opt of optRows) {
        if (!optsByGame.has(opt.game_id)) optsByGame.set(opt.game_id, new Map());
        optsByGame.get(opt.game_id)!.set(opt.symbol, opt.label);
      }

      const phGameRows =
        gameIds.length > 0
          ? await query<{ game_id: number; change_amount: number }>(
              `SELECT game_id, SUM(change_amount)::integer AS change_amount
               FROM point_history WHERE user_id = $1 AND game_id = ANY($2) AND reason = 'game_result'
               GROUP BY game_id`,
              [id, gameIds],
            )
          : [];
      const phByGame = new Map(phGameRows.map((r) => [r.game_id, r.change_amount]));

      const dhGameRows =
        gameIds.length > 0
          ? await query<{ game_id: number; change_amount: number }>(
              `SELECT game_id, SUM(change_amount)::integer AS change_amount
               FROM debt_history WHERE user_id = $1 AND game_id = ANY($2) AND reason = 'bet_placed'
               GROUP BY game_id`,
              [id, gameIds],
            )
          : [];
      const dhByGame = new Map(dhGameRows.map((r) => [r.game_id, r.change_amount]));

      let wins = 0;
      let losses = 0;
      const games = betRows.map((b) => {
        const optMap = optsByGame.get(b.game_id) ?? new Map<string, string>();
        const selectedLabels = b.selected_symbols.split('').map((s) => optMap.get(s) ?? s);
        const result: 'win' | 'lose' =
          b.selected_symbols === b.result_symbols ? 'win' : 'lose';
        const pointChange = result === 'win' ? (phByGame.get(b.game_id) ?? 0) : 0;
        const debtChange = dhByGame.get(b.game_id) ?? 0;

        if (result === 'win') wins++;
        else losses++;

        return {
          gameId: b.game_id,
          gameTitle: b.game_title,
          betType: b.bet_type,
          requiredSelections: b.required_selections,
          selectedSymbols: b.selected_symbols,
          selectedLabels,
          amount: b.amount,
          isDebt: b.is_debt,
          debtChange,
          pointChange,
          result,
        };
      });

      res.json({
        data: {
          userId: Number(id),
          eventId: event.id,
          totalPointChange,
          totalDebt,
          totalAssets,
          totalAssetsChange,
          wins,
          losses,
          games,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
