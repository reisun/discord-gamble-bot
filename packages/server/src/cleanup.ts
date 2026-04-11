/**
 * 古いイベントデータの自動クリーンアップ.
 *
 * ポリシー: イベントに初めてユーザー情報（bet）が登録された日時から2週間後に削除。
 * 実行タイミング: サーバー起動時 + 24時間間隔。
 */

import { query, withTransaction } from './db';
import { logger } from './logger';

const RETENTION_DAYS = 14;
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * イベントに初めてbet（ユーザー情報）が登録されてから2週間経過した
 * イベントとその関連データを削除する。
 * また、どのアクティブイベントにも紐づかないユーザーの個人情報をNULL化する。
 */
export async function runCleanup(): Promise<void> {
  logger.info('[cleanup] Starting expired event cleanup...');

  try {
    const deleted = await withTransaction(async (client) => {
      // 対象イベントを特定:
      // イベントに紐づく最初の bet の created_at から RETENTION_DAYS 日経過したもの
      const { rows: expiredEvents } = await client.query(
        `SELECT e.id FROM events e
         WHERE EXISTS (
           SELECT 1 FROM bets b
           JOIN games g ON g.id = b.game_id
           WHERE g.event_id = e.id
           HAVING MIN(b.created_at) < NOW() - INTERVAL '${RETENTION_DAYS} days'
         )`,
      );

      if (expiredEvents.length === 0) {
        return 0;
      }

      const eventIds = expiredEvents.map((r) => r.id);
      logger.info(`[cleanup] Found ${eventIds.length} expired events: ${eventIds.join(', ')}`);

      // 関連データを子→親の順で削除
      // 1. bets (game_id 経由)
      await client.query(
        `DELETE FROM bets
         WHERE game_id IN (SELECT id FROM games WHERE event_id = ANY($1))`,
        [eventIds],
      );

      // 2. bet_options (game_id 経由)
      await client.query(
        `DELETE FROM bet_options
         WHERE game_id IN (SELECT id FROM games WHERE event_id = ANY($1))`,
        [eventIds],
      );

      // 3. point_history (event_id 直接)
      await client.query(
        `DELETE FROM point_history WHERE event_id = ANY($1)`,
        [eventIds],
      );

      // 4. debt_history (event_id 直接)
      await client.query(
        `DELETE FROM debt_history WHERE event_id = ANY($1)`,
        [eventIds],
      );

      // 5. games (event_id 直接)
      await client.query(
        `DELETE FROM games WHERE event_id = ANY($1)`,
        [eventIds],
      );

      // 6. events
      await client.query(
        `DELETE FROM events WHERE id = ANY($1)`,
        [eventIds],
      );

      // 7. ユーザー個人情報のNULL化
      //    期限切れでないイベントに参加していないユーザーが対象
      await client.query(
        `UPDATE users
         SET discord_name = NULL, discord_avatar_url = NULL
         WHERE (discord_name IS NOT NULL OR discord_avatar_url IS NOT NULL)
           AND id NOT IN (
             SELECT DISTINCT b.user_id FROM bets b
             JOIN games g ON g.id = b.game_id
             JOIN events e ON e.id = g.event_id
             WHERE e.id != ALL($1)
           )`,
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
