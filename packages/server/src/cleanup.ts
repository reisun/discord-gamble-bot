/**
 * 古いデータの自動クリーンアップ.
 *
 * ポリシー: ユーザー情報は登録から2週間後にマスク。イベントデータは保持。
 * 実行タイミング: サーバー起動時 + 24時間間隔。
 */

import { query, withTransaction } from './db';
import { logger } from './logger';

const RETENTION_DAYS = 14;
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * 登録から2週間経過したユーザーの個人情報をマスクする。
 * 期限切れのセッション・アクセストークンも削除する。
 * イベントデータは匿名化された状態で保持される。
 */
export async function runCleanup(): Promise<void> {
  logger.info('[cleanup] Starting cleanup...');

  try {
    await withTransaction(async (client) => {
      // 1. 登録から2週間経過したユーザーの個人情報をマスク
      const { rowCount: nullifiedCount } = await client.query(
        `UPDATE users
         SET discord_id = 'deleted_' || id::text, discord_name = NULL, discord_avatar_url = NULL
         WHERE discord_id NOT LIKE 'deleted_%'
           AND created_at < NOW() - INTERVAL '${RETENTION_DAYS} days'`,
      );
      if (nullifiedCount && nullifiedCount > 0) {
        logger.info(`[cleanup] Masked personal info for ${nullifiedCount} user(s).`);
      }

      // 2. 期限切れセッションの削除（discord_user_id, discord_username を含む）
      const { rowCount: deletedSessions } = await client.query(
        `DELETE FROM sessions WHERE expires_at < NOW()`,
      );
      if (deletedSessions && deletedSessions > 0) {
        logger.info(`[cleanup] Deleted ${deletedSessions} expired session(s).`);
      }

      // 3. 期限切れアクセストークンの削除
      const { rowCount: deletedTokens } = await client.query(
        `DELETE FROM access_tokens WHERE expires_at < NOW()`,
      );
      if (deletedTokens && deletedTokens > 0) {
        logger.info(`[cleanup] Deleted ${deletedTokens} expired access token(s).`);
      }
    });

    logger.info('[cleanup] Cleanup complete.');
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
