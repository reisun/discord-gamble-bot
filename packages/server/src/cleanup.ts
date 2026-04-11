/**
 * 古いデータの自動クリーンアップ.
 *
 * ポリシー: ユーザー情報は登録から2週間後に自動削除。
 * 実行タイミング: サーバー起動時 + 24時間間隔。
 */

import { query, withTransaction } from './db';
import { logger } from './logger';

const RETENTION_DAYS = 14;
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * 登録から2週間経過したユーザーの個人情報をNULL化し、
 * 全ユーザーの個人情報がNULL化されたイベントとその関連データを削除する。
 */
export async function runCleanup(): Promise<void> {
  logger.info('[cleanup] Starting cleanup...');

  try {
    const deleted = await withTransaction(async (client) => {
      // 1. 登録から2週間経過したユーザーの個人情報をNULL化
      const { rowCount: nullifiedCount } = await client.query(
        `UPDATE users
         SET discord_name = NULL, discord_avatar_url = NULL
         WHERE (discord_name IS NOT NULL OR discord_avatar_url IS NOT NULL)
           AND created_at < NOW() - INTERVAL '${RETENTION_DAYS} days'`,
      );
      if (nullifiedCount && nullifiedCount > 0) {
        logger.info(`[cleanup] Nullified personal info for ${nullifiedCount} user(s).`);
      }

      // 2. 全参加ユーザーの個人情報がNULL化されたイベントを削除対象とする
      //    （= イベントに紐づくbetのユーザー全員がNULL化済み）
      const { rows: expiredEvents } = await client.query(
        `SELECT e.id FROM events e
         WHERE EXISTS (
           SELECT 1 FROM bets b
           JOIN games g ON g.id = b.game_id
           WHERE g.event_id = e.id
         )
         AND NOT EXISTS (
           SELECT 1 FROM bets b
           JOIN games g ON g.id = b.game_id
           JOIN users u ON u.id = b.user_id
           WHERE g.event_id = e.id
             AND (u.discord_name IS NOT NULL OR u.discord_avatar_url IS NOT NULL)
         )`,
      );

      if (expiredEvents.length === 0) {
        return 0;
      }

      const eventIds = expiredEvents.map((r) => r.id);
      logger.info(`[cleanup] Found ${eventIds.length} expired events: ${eventIds.join(', ')}`);

      // 3. 関連データを子→親の順で削除
      // bets (game_id 経由)
      await client.query(
        `DELETE FROM bets
         WHERE game_id IN (SELECT id FROM games WHERE event_id = ANY($1))`,
        [eventIds],
      );

      // bet_options (game_id 経由)
      await client.query(
        `DELETE FROM bet_options
         WHERE game_id IN (SELECT id FROM games WHERE event_id = ANY($1))`,
        [eventIds],
      );

      // point_history (event_id 直接)
      await client.query(
        `DELETE FROM point_history WHERE event_id = ANY($1)`,
        [eventIds],
      );

      // debt_history (event_id 直接)
      await client.query(
        `DELETE FROM debt_history WHERE event_id = ANY($1)`,
        [eventIds],
      );

      // games (event_id 直接)
      await client.query(
        `DELETE FROM games WHERE event_id = ANY($1)`,
        [eventIds],
      );

      // events
      await client.query(
        `DELETE FROM events WHERE id = ANY($1)`,
        [eventIds],
      );

      return eventIds.length;
    });

    logger.info(`[cleanup] Cleanup complete. Deleted ${deleted} expired event(s).`);
  } catch (err) {
    logger.error('[cleanup] Cleanup failed:', err);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

/** クリーンアップスケジューラを開始する（起動時に即実行 + 24h間隔） */
export function startCleanupScheduler(): void {
  // 起動時に即実行
  runCleanup();

  // 24時間間隔で繰り返し
  intervalId = setInterval(runCleanup, INTERVAL_MS);
  logger.info(`[cleanup] Scheduler started (interval: ${INTERVAL_MS / 3600000}h)`);
}

/** スケジューラを停止する（テスト用） */
export function stopCleanupScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
