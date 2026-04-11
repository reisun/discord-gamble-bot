import { describe, it, expect } from 'vitest';
import { pool, query } from '../db';
import { runCleanup } from '../cleanup';

const TEST_GUILD_ID = 'test-guild-001';

/** テスト用にイベントを作成し、updated_at を指定日数前に設定 */
async function createExpiredEvent(name: string, daysAgo: number): Promise<number> {
  const [event] = await query<{ id: number }>(
    `INSERT INTO events (name, guild_id, is_active, is_published, initial_points, results_public)
     VALUES ($1, $2, FALSE, TRUE, 10000, FALSE)
     RETURNING id`,
    [name, TEST_GUILD_ID],
  );
  await pool.query(
    `UPDATE events SET updated_at = NOW() - INTERVAL '${daysAgo} days' WHERE id = $1`,
    [event.id],
  );
  return event.id;
}

/** テスト用にアクティブイベントを作成 */
async function createActiveEvent(name: string): Promise<number> {
  const [event] = await query<{ id: number }>(
    `INSERT INTO events (name, guild_id, is_active, is_published, initial_points, results_public)
     VALUES ($1, $2, TRUE, TRUE, 10000, FALSE)
     RETURNING id`,
    [name, TEST_GUILD_ID],
  );
  return event.id;
}

/** テスト用にゲーム・賭け・ユーザーを作成 */
async function createGameWithBets(eventId: number): Promise<{ gameId: number; userId: number }> {
  const [game] = await query<{ id: number }>(
    `INSERT INTO games (event_id, title, deadline, status, bet_type, required_selections)
     VALUES ($1, 'テストゲーム', NOW() - INTERVAL '1 day', 'finished', 'single', NULL)
     RETURNING id`,
    [eventId],
  );

  await query(
    `INSERT INTO bet_options (game_id, symbol, label, "order")
     VALUES ($1, 'A', '選択A', 1), ($1, 'B', '選択B', 2)`,
    [game.id],
  );

  const [user] = await query<{ id: number }>(
    `INSERT INTO users (discord_id, discord_name, discord_avatar_url)
     VALUES ($1, 'テストユーザー', 'https://cdn.discordapp.com/avatars/123/abc.png')
     ON CONFLICT (discord_id) DO UPDATE SET discord_name = EXCLUDED.discord_name
     RETURNING id`,
    [`user-${Date.now()}`],
  );

  await query(
    `INSERT INTO bets (user_id, game_id, selected_symbols, amount)
     VALUES ($1, $2, 'A', 100)`,
    [user.id, game.id],
  );

  await query(
    `INSERT INTO point_history (user_id, event_id, game_id, change_amount, reason)
     VALUES ($1, $2, $3, -100, 'bet_placed')`,
    [user.id, eventId, game.id],
  );

  await query(
    `INSERT INTO debt_history (user_id, event_id, game_id, change_amount, reason)
     VALUES ($1, $2, $3, 50, 'bet_placed')`,
    [user.id, eventId, game.id],
  );

  return { gameId: game.id, userId: user.id };
}

describe('runCleanup', () => {
  it('2週間以上前に終了したイベントの関連データを削除する', async () => {
    const eventId = await createExpiredEvent('古いイベント', 15);
    await createGameWithBets(eventId);

    await runCleanup();

    const events = await query('SELECT id FROM events WHERE id = $1', [eventId]);
    const games = await query('SELECT id FROM games WHERE event_id = $1', [eventId]);
    const bets = await query(
      'SELECT id FROM bets WHERE game_id IN (SELECT id FROM games WHERE event_id = $1)',
      [eventId],
    );
    const pointHistory = await query('SELECT id FROM point_history WHERE event_id = $1', [eventId]);
    const debtHistory = await query('SELECT id FROM debt_history WHERE event_id = $1', [eventId]);

    expect(events).toHaveLength(0);
    expect(games).toHaveLength(0);
    expect(bets).toHaveLength(0);
    expect(pointHistory).toHaveLength(0);
    expect(debtHistory).toHaveLength(0);
  });

  it('2週間未満のイベントは削除しない', async () => {
    const eventId = await createExpiredEvent('最近のイベント', 10);
    await createGameWithBets(eventId);

    await runCleanup();

    const events = await query('SELECT id FROM events WHERE id = $1', [eventId]);
    expect(events).toHaveLength(1);
  });

  it('アクティブなイベントは削除しない', async () => {
    const eventId = await createActiveEvent('開催中イベント');
    await createGameWithBets(eventId);

    await runCleanup();

    const events = await query('SELECT id FROM events WHERE id = $1', [eventId]);
    expect(events).toHaveLength(1);
  });

  it('アクティブイベントに参加していないユーザーの個人情報をNULL化する', async () => {
    const eventId = await createExpiredEvent('古いイベント', 15);
    const { userId } = await createGameWithBets(eventId);

    await runCleanup();

    const [user] = await query<{ discord_name: string | null; discord_avatar_url: string | null }>(
      'SELECT discord_name, discord_avatar_url FROM users WHERE id = $1',
      [userId],
    );
    expect(user.discord_name).toBeNull();
    expect(user.discord_avatar_url).toBeNull();
  });

  it('アクティブイベントに参加しているユーザーの個人情報は保持する', async () => {
    // 古いイベント
    const oldEventId = await createExpiredEvent('古いイベント', 15);
    const { userId } = await createGameWithBets(oldEventId);

    // 同じユーザーがアクティブイベントにも参加
    const activeEventId = await createActiveEvent('開催中イベント');
    const [game] = await query<{ id: number }>(
      `INSERT INTO games (event_id, title, deadline, status, bet_type, required_selections)
       VALUES ($1, 'アクティブゲーム', NOW() + INTERVAL '1 day', 'open', 'single', NULL) RETURNING id`,
      [activeEventId],
    );
    await query(
      `INSERT INTO bets (user_id, game_id, selected_symbols, amount) VALUES ($1, $2, 'A', 50)`,
      [userId, game.id],
    );

    await runCleanup();

    const [user] = await query<{ discord_name: string | null; discord_avatar_url: string | null }>(
      'SELECT discord_name, discord_avatar_url FROM users WHERE id = $1',
      [userId],
    );
    expect(user.discord_name).toBe('テストユーザー');
    expect(user.discord_avatar_url).toBe('https://cdn.discordapp.com/avatars/123/abc.png');
  });

  it('対象イベントがない場合はエラーなく完了する', async () => {
    await expect(runCleanup()).resolves.not.toThrow();
  });
});
