import { describe, it, expect } from 'vitest';
import { pool, query } from '../db';
import { runCleanup } from '../cleanup';

const TEST_GUILD_ID = 'test-guild-001';

/** テスト用にイベント・ゲーム・ユーザー・賭けを作成 */
async function createUserWithBet(
  userDaysAgo: number = 0
): Promise<{ eventId: number; userId: number }> {
  const [event] = await query<{ id: number }>(
    `INSERT INTO events (name, guild_id, is_active, is_published, initial_points, results_public)
     VALUES ('テストイベント', $1, FALSE, TRUE, 10000, FALSE) RETURNING id`,
    [TEST_GUILD_ID]
  );

  const [game] = await query<{ id: number }>(
    `INSERT INTO games (event_id, title, deadline, status, bet_type, required_selections)
     VALUES ($1, 'テストゲーム', NOW() - INTERVAL '1 day', 'finished', 'single', NULL) RETURNING id`,
    [event.id]
  );

  const discordId = `${Date.now()}`;
  const [user] = await query<{ id: number }>(
    `INSERT INTO users (discord_id, discord_name, discord_avatar_url)
     VALUES ($1, 'テストユーザー', 'https://cdn.discordapp.com/avatars/123/abc.png') RETURNING id`,
    [discordId]
  );

  if (userDaysAgo > 0) {
    await pool.query(
      `UPDATE users SET created_at = NOW() - INTERVAL '${userDaysAgo} days' WHERE id = $1`,
      [user.id]
    );
  }

  await query(
    `INSERT INTO bets (user_id, game_id, selected_symbols, amount) VALUES ($1, $2, 'A', 100)`,
    [user.id, game.id]
  );

  return { eventId: event.id, userId: user.id };
}

describe('runCleanup', () => {
  it('登録から2週間経過したユーザーの個人情報をマスクする', async () => {
    const { userId } = await createUserWithBet(15);

    await runCleanup();

    const [user] = await query<{
      discord_id: string;
      discord_name: string | null;
      discord_avatar_url: string | null;
    }>('SELECT discord_id, discord_name, discord_avatar_url FROM users WHERE id = $1', [userId]);
    expect(user.discord_id).toBe(`deleted_${userId}`);
    expect(user.discord_name).toBeNull();
    expect(user.discord_avatar_url).toBeNull();
  });

  it('登録から2週間未満のユーザーの個人情報は保持する', async () => {
    const { userId } = await createUserWithBet(10);

    await runCleanup();

    const [user] = await query<{ discord_name: string | null }>(
      'SELECT discord_name FROM users WHERE id = $1',
      [userId]
    );
    expect(user.discord_name).toBe('テストユーザー');
  });

  it('マスク後もイベントデータは保持される', async () => {
    const { eventId, userId } = await createUserWithBet(15);

    await runCleanup();

    // ユーザーはマスク済み
    const [user] = await query<{ discord_id: string }>(
      'SELECT discord_id FROM users WHERE id = $1',
      [userId]
    );
    expect(user.discord_id).toMatch(/^deleted_/);

    // イベントデータは残っている
    const events = await query('SELECT id FROM events WHERE id = $1', [eventId]);
    const games = await query('SELECT id FROM games WHERE event_id = $1', [eventId]);
    expect(events).toHaveLength(1);
    expect(games).toHaveLength(1);
  });

  it('対象がない場合はエラーなく完了する', async () => {
    await expect(runCleanup()).resolves.not.toThrow();
  });
});
