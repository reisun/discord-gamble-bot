import { Router, Request, Response, NextFunction } from 'express';
import { query, withTransaction } from '../db';
import { isAdmin, optionalAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router({ mergeParams: true });

type GameRow = {
  id: number;
  event_id: number;
  is_published: boolean;
  status: string;
  bet_type: string;
  required_selections: number | null;
  result_symbols: string | null;
  deadline: Date;
};

type BetOptionRow = {
  symbol: string;
  label: string;
};

type BetRow = {
  id: number;
  user_id: number;
  game_id: number;
  selected_symbols: string;
  amount: number;
  is_debt: boolean;
  created_at: Date;
  updated_at: Date;
};

type UserRow = {
  id: number;
  discord_id: string;
  discord_name: string;
  discord_avatar_url: string | null;
};

function computeEffectiveStatus(game: GameRow): 'open' | 'closed' | 'finished' {
  if (game.status === 'finished') return 'finished';
  if (!game.is_published) return 'open';
  if (new Date(game.deadline) < new Date()) return 'closed';
  return 'open';
}

/** 記号文字列から対応するラベルの配列を返す */
function symbolsToLabels(symbols: string, optMap: Map<string, string>): string[] {
  return symbols.split('').map((s) => optMap.get(s) ?? s);
}

/** パリミュチュエル方式で組み合わせごとの倍率を計算する */
function computeOdds(
  bets: BetRow[],
): Map<string, { totalPoints: number; betCount: number; odds: number }> {
  const totalPoints = bets.reduce((sum, b) => sum + b.amount, 0);
  const combMap = new Map<string, { totalPoints: number; betCount: number }>();

  for (const bet of bets) {
    const key = bet.selected_symbols;
    const cur = combMap.get(key) ?? { totalPoints: 0, betCount: 0 };
    combMap.set(key, {
      totalPoints: cur.totalPoints + bet.amount,
      betCount: cur.betCount + 1,
    });
  }

  const result = new Map<string, { totalPoints: number; betCount: number; odds: number }>();
  for (const [key, val] of combMap.entries()) {
    result.set(key, {
      ...val,
      odds: val.totalPoints > 0 ? Math.round((totalPoints / val.totalPoints) * 100) / 100 : 0,
    });
  }
  return result;
}

// GET /api/games/:gameId/bets
router.get('/', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gameId } = req.params;
    const adminMode = isAdmin(req);

    const gameRows = await query<GameRow>('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameRows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'ゲームが見つかりません');
    }
    const game = gameRows[0];
    if (!adminMode && !game.is_published) {
      throw new AppError(404, 'NOT_FOUND', 'ゲームが見つかりません');
    }
    const effectiveStatus = computeEffectiveStatus(game);
    const isFinished = effectiveStatus === 'finished';

    const optionRows = await query<BetOptionRow>(
      'SELECT symbol, label FROM bet_options WHERE game_id = $1 ORDER BY "order"',
      [gameId],
    );
    const optMap = new Map(optionRows.map((o) => [o.symbol, o.label]));

    const betRows = await query<BetRow & { discord_name: string; discord_avatar_url: string | null }>(
      `SELECT b.id, b.user_id, b.game_id, b.selected_symbols, b.amount, b.is_debt,
              b.created_at, b.updated_at, u.discord_name, u.discord_avatar_url
       FROM bets b
       JOIN users u ON u.id = b.user_id
       WHERE b.game_id = $1`,
      [gameId],
    );

    const oddsMap = computeOdds(betRows);
    const totalPoints = betRows.reduce((sum, b) => sum + b.amount, 0);

    // combinations
    const combinations = Array.from(oddsMap.entries()).map(([selectedSymbols, stats]) => ({
      selectedSymbols,
      selectedLabels: symbolsToLabels(selectedSymbols, optMap),
      totalPoints: adminMode || isFinished ? stats.totalPoints : undefined,
      betCount: adminMode || isFinished ? stats.betCount : undefined,
      odds: stats.odds,
    }));

    // pointChange per bet (only for finished)
    let pointChanges: Map<number, number> | null = null;
    if (isFinished) {
      const phRows = await query<{ user_id: number; change_amount: number }>(
        "SELECT user_id, SUM(change_amount)::integer AS change_amount FROM point_history WHERE game_id = $1 AND reason = 'game_result' GROUP BY user_id",
        [gameId],
      );
      pointChanges = new Map(phRows.map((r) => [r.user_id, r.change_amount]));
    }

    const bets = betRows.map((b) => {
      const result: 'win' | 'lose' | null = isFinished
        ? b.selected_symbols === game.result_symbols
          ? 'win'
          : 'lose'
        : null;
      const pointChange =
        isFinished && result === 'win' ? (pointChanges?.get(b.user_id) ?? 0) : isFinished ? 0 : undefined;

      return {
        userId: b.user_id,
        userName: b.discord_name,
        avatarUrl: b.discord_avatar_url ?? null,
        selectedSymbols: b.selected_symbols,
        selectedLabels: symbolsToLabels(b.selected_symbols, optMap),
        amount: b.amount,
        isDebt: b.is_debt,
        result,
        ...(isFinished ? { pointChange } : {}),
      };
    });

    res.json({
      data: {
        betType: game.bet_type,
        requiredSelections: game.required_selections,
        totalPoints: adminMode || isFinished ? totalPoints : undefined,
        combinations,
        bets,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/games/:gameId/bets
router.put('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gameId } = req.params;
    const {
      discordId,
      discordName,
      avatarUrl,
      selectedSymbols,
      amount,
      allowDebt = false,
    } = req.body as {
      discordId?: string;
      discordName?: string;
      avatarUrl?: string;
      selectedSymbols?: string;
      amount?: number;
      allowDebt?: boolean;
    };

    if (!discordId || typeof discordId !== 'string') {
      throw new AppError(400, 'VALIDATION_ERROR', 'discordId は必須です');
    }
    if (discordName !== undefined && (typeof discordName !== 'string' || discordName.trim().length === 0 || discordName.length > 100)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'discordName は1〜100文字で指定してください');
    }
    if (!selectedSymbols || typeof selectedSymbols !== 'string') {
      throw new AppError(400, 'VALIDATION_ERROR', 'selectedSymbols は必須です');
    }
    if (!amount || !Number.isInteger(amount) || amount < 1) {
      throw new AppError(400, 'VALIDATION_ERROR', 'amount は1以上の整数で指定してください');
    }

    const result = await withTransaction(async (client) => {
      const gameRows = await client.query<GameRow>('SELECT * FROM games WHERE id = $1 FOR UPDATE', [gameId]);
      if (gameRows.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'ゲームが見つかりません');

      const game = gameRows.rows[0];
      if (!game.is_published) {
        throw new AppError(409, 'CONFLICT', 'このゲームはまだ公開されていません');
      }
      const effectiveStatus = computeEffectiveStatus(game);

      if (effectiveStatus !== 'open') {
        throw new AppError(409, 'CONFLICT', 'このゲームへの賭けは受け付けていません（締め切り済み）');
      }

      // Validate selectedSymbols per betType
      const optRows = await client.query<BetOptionRow>(
        'SELECT symbol, label FROM bet_options WHERE game_id = $1',
        [gameId],
      );
      const optMap = new Map(optRows.rows.map((o) => [o.symbol, o.label]));
      const chars = selectedSymbols.split('');

      for (const ch of chars) {
        if (!optMap.has(ch)) {
          throw new AppError(400, 'VALIDATION_ERROR', `記号 ${ch} はこのゲームに存在しません`);
        }
      }

      let normalizedSymbols = selectedSymbols;
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
          normalizedSymbols = chars.sort().join('');
        }
      }

      // Ensure user exists (upsert by discordId); update name/avatar if provided
      const resolvedName = discordName ?? discordId;
      let userRows = await client.query<UserRow>(
        'SELECT id, discord_id, discord_name, discord_avatar_url FROM users WHERE discord_id = $1',
        [discordId],
      );

      if (userRows.rows.length === 0) {
        userRows = await client.query<UserRow>(
          'INSERT INTO users (discord_id, discord_name, discord_avatar_url) VALUES ($1, $2, $3) RETURNING id, discord_id, discord_name, discord_avatar_url',
          [discordId, resolvedName, avatarUrl ?? null],
        );
      } else {
        const existing = userRows.rows[0];
        const nameChanged = discordName && existing.discord_name !== discordName;
        const avatarChanged = avatarUrl !== undefined && existing.discord_avatar_url !== avatarUrl;
        if (nameChanged || avatarChanged) {
          userRows = await client.query<UserRow>(
            'UPDATE users SET discord_name = $1, discord_avatar_url = $2, updated_at = NOW() WHERE discord_id = $3 RETURNING id, discord_id, discord_name, discord_avatar_url',
            [discordName ?? existing.discord_name, avatarUrl ?? existing.discord_avatar_url, discordId],
          );
        }
      }
      const user = userRows.rows[0];

      // Check for existing bet
      const existingBet = await client.query<BetRow>(
        'SELECT * FROM bets WHERE user_id = $1 AND game_id = $2',
        [user.id, gameId],
      );

      if (!allowDebt) {
        // Check sufficient points
        const pointRows = await client.query<{ current_points: number }>(
          `SELECT (e.initial_points + COALESCE(SUM(ph.change_amount), 0))::integer AS current_points
           FROM events e
           LEFT JOIN point_history ph ON ph.user_id = $1 AND ph.event_id = e.id
           WHERE e.id = $2
           GROUP BY e.initial_points`,
          [user.id, game.event_id],
        );
        const currentPoints = pointRows.rows[0]?.current_points ?? game.event_id; // fallback unused

        // If updating, the old bet amount will be refunded, so effective cost = new amount - old amount
        const oldAmount = existingBet.rows[0]?.is_debt === false ? existingBet.rows[0].amount : 0;
        const netCost = amount - oldAmount;
        const availablePoints = pointRows.rows[0]?.current_points ?? 0;

        if (netCost > availablePoints) {
          throw new AppError(409, 'CONFLICT', `ポイントが不足しています（所持: ${availablePoints}pt、必要: ${netCost}pt）`);
        }
      }

      let isUpdated = false;
      let debtAmount = 0;

      if (existingBet.rows.length > 0) {
        isUpdated = true;
        const old = existingBet.rows[0];

        // Refund old bet
        if (!old.is_debt) {
          await client.query(
            `INSERT INTO point_history (user_id, event_id, game_id, change_amount, reason)
             VALUES ($1, $2, $3, $4, 'bet_refunded')`,
            [user.id, game.event_id, gameId, old.amount],
          );
        } else {
          await client.query(
            `INSERT INTO debt_history (user_id, event_id, game_id, change_amount, reason)
             VALUES ($1, $2, $3, $4, 'bet_refunded')`,
            [user.id, game.event_id, gameId, -old.amount],
          );
        }

        // Update bet record
        await client.query(
          `UPDATE bets SET selected_symbols = $1, amount = $2, is_debt = $3, updated_at = NOW()
           WHERE id = $4`,
          [normalizedSymbols, amount, allowDebt, old.id],
        );
      } else {
        // Insert new bet
        await client.query(
          `INSERT INTO bets (user_id, game_id, selected_symbols, amount, is_debt)
           VALUES ($1, $2, $3, $4, $5)`,
          [user.id, gameId, normalizedSymbols, amount, allowDebt],
        );
      }

      // Record new bet cost
      if (!allowDebt) {
        await client.query(
          `INSERT INTO point_history (user_id, event_id, game_id, change_amount, reason)
           VALUES ($1, $2, $3, $4, 'bet_placed')`,
          [user.id, game.event_id, gameId, -amount],
        );
      } else {
        debtAmount = amount;
        await client.query(
          `INSERT INTO debt_history (user_id, event_id, game_id, change_amount, reason)
           VALUES ($1, $2, $3, $4, 'bet_placed')`,
          [user.id, game.event_id, gameId, amount],
        );
      }

      // Fetch final bet record
      const finalBet = await client.query<BetRow>(
        'SELECT * FROM bets WHERE user_id = $1 AND game_id = $2',
        [user.id, gameId],
      );
      const bet = finalBet.rows[0];

      return {
        bet,
        optMap,
        isUpdated,
        debtAmount,
      };
    });

    res.json({
      data: {
        id: result.bet.id,
        gameId: Number(gameId),
        userId: result.bet.user_id,
        selectedSymbols: result.bet.selected_symbols,
        selectedLabels: symbolsToLabels(result.bet.selected_symbols, result.optMap),
        amount: result.bet.amount,
        isDebt: result.bet.is_debt,
        debtAmount: result.debtAmount,
        isUpdated: result.isUpdated,
        createdAt: result.bet.created_at,
        updatedAt: result.bet.updated_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
