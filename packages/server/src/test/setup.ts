import { beforeEach, afterAll } from 'vitest';
import { pool } from '../db';

/** 各テスト前: 全テーブルを TRUNCATE してクリーンな状態にする */
beforeEach(async () => {
  await pool.query(
    'TRUNCATE events, games, bet_options, users, bets, point_history, debt_history RESTART IDENTITY CASCADE',
  );
});

/** 全テスト終了後: コネクションプールを閉じる */
afterAll(async () => {
  await pool.end();
});
