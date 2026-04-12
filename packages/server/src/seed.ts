/**
 * シードデータスクリプト
 * 開発・デモ用の初期データを投入します。
 * 実行: npm run seed
 */

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── 既存データのクリア（参照整合性順）──────────────────────────────
    await client.query('DELETE FROM debt_history');
    await client.query('DELETE FROM point_history');
    await client.query('DELETE FROM bets');
    await client.query('DELETE FROM bet_options');
    await client.query('DELETE FROM games');
    await client.query('DELETE FROM events');
    await client.query('DELETE FROM users');

    // ── events ────────────────────────────────────────────────────────
    const eventsRes = await client.query<{ id: number }>(`
      INSERT INTO events (name, is_active, initial_points, results_public) VALUES
        ('デモイベント2026',      TRUE,  10000, TRUE),
        ('過去イベント2025',      FALSE, 10000, FALSE)
      RETURNING id
    `);
    const [activeEventId, pastEventId] = eventsRes.rows.map((r) => r.id);

    // ── games ─────────────────────────────────────────────────────────
    const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 1週間後
    const pastDeadline = '2025-12-31T23:59:59+09:00';

    const gamesRes = await client.query<{ id: number }>(
      `
      INSERT INTO games (event_id, title, description, deadline, is_published, status, bet_type, required_selections) VALUES
        ($1, '第1試合: チームA vs チームB', '単純勝敗予想（single）', $2, TRUE,  'open',     'single',          NULL),
        ($1, '第2試合: MVP選手予想',        '複数候補から順不同で2名選択（multi_unordered）', $2, TRUE, 'open', 'multi_unordered', 2),
        ($1, '第3試合: 1〜3着予想',         '3着まで順番通りに選択（multi_ordered）', $2, FALSE, 'open', 'multi_ordered',   3),
        ($3, '過去試合: チームX vs Y',      '過去イベントの完結したゲーム', $4, TRUE, 'finished', 'single',         NULL)
      RETURNING id
    `,
      [activeEventId, deadline, pastEventId, pastDeadline]
    );
    const [game1Id, game2Id, game3Id, game4Id] = gamesRes.rows.map((r) => r.id);

    // 過去ゲームの結果を設定
    await client.query(`UPDATE games SET result_symbols = 'A' WHERE id = $1`, [game4Id]);

    // ── bet_options ───────────────────────────────────────────────────
    await client.query(
      `
      INSERT INTO bet_options (game_id, symbol, label, "order") VALUES
        ($1, 'A', 'チームA', 1),
        ($1, 'B', 'チームB', 2),
        ($2, 'A', '田中選手', 1),
        ($2, 'B', '鈴木選手', 2),
        ($2, 'C', '佐藤選手', 3),
        ($2, 'D', '伊藤選手', 4),
        ($3, 'A', '選手A', 1),
        ($3, 'B', '選手B', 2),
        ($3, 'C', '選手C', 3),
        ($3, 'D', '選手D', 4),
        ($3, 'E', '選手E', 5),
        ($4, 'A', 'チームX', 1),
        ($4, 'B', 'チームY', 2)
    `,
      [game1Id, game2Id, game3Id, game4Id]
    );

    // ── users ─────────────────────────────────────────────────────────
    const usersRes = await client.query<{ id: number }>(`
      INSERT INTO users (discord_id, discord_name) VALUES
        ('100000000000000001', 'Alice'),
        ('100000000000000002', 'Bob'),
        ('100000000000000003', 'Charlie'),
        ('100000000000000004', 'Diana'),
        ('100000000000000005', 'Eve')
      RETURNING id
    `);
    const [aliceId, bobId, charlieId, dianaId, eveId] = usersRes.rows.map((r) => r.id);

    // ── bets（現在の開催中イベントのゲーム1, 2 に対して賭け）─────────
    await client.query(
      `
      INSERT INTO bets (user_id, game_id, selected_symbols, amount, is_debt) VALUES
        ($1, $5, 'A', 1000, FALSE),
        ($2, $5, 'B', 2000, FALSE),
        ($3, $5, 'A', 500,  FALSE),
        ($4, $5, 'A', 3000, FALSE),
        ($5, $5, 'B', 800,  TRUE),
        ($1, $6, 'AC', 1500, FALSE),
        ($2, $6, 'BD', 1000, FALSE),
        ($3, $6, 'AB', 2000, FALSE)
    `,
      [aliceId, bobId, charlieId, dianaId, eveId, game1Id, game2Id]
    );

    // ── point_history（過去イベントのポイント移動）────────────────────
    // 過去イベント: チームX が勝利（result='A'）
    // ゲーム4: 総賭けポイント = A:5000, B:3000 → 合計8000
    //   Aの倍率 = 8000/5000 = 1.6倍
    const pastBetAmount = 5000;
    const pastWinMultiplier = 1.6;

    // Alice と Charlie が A に賭けて勝利（仮想的な過去データ）
    const pastWinners = [
      { userId: aliceId, betAmount: 3000 },
      { userId: charlieId, betAmount: 2000 },
    ];

    for (const w of pastWinners) {
      // 賭け時のポイント消費
      await client.query(
        `INSERT INTO point_history (user_id, event_id, game_id, change_amount, reason)
         VALUES ($1, $2, $3, $4, 'bet_placed')`,
        [w.userId, pastEventId, game4Id, -w.betAmount]
      );
      // 当選時の獲得
      const winAmount = Math.floor(w.betAmount * pastWinMultiplier);
      await client.query(
        `INSERT INTO point_history (user_id, event_id, game_id, change_amount, reason)
         VALUES ($1, $2, $3, $4, 'game_result')`,
        [w.userId, pastEventId, game4Id, winAmount]
      );
    }

    // Bob は B に賭けて敗北
    await client.query(
      `INSERT INTO point_history (user_id, event_id, game_id, change_amount, reason)
       VALUES ($1, $2, $3, $4, 'bet_placed')`,
      [bobId, pastEventId, game4Id, -3000]
    );

    // ── point_history（現在の開催中イベント: 賭け時の消費）──────────
    const currentBets = [
      { userId: aliceId, gameId: game1Id, amount: 1000 },
      { userId: bobId, gameId: game1Id, amount: 2000 },
      { userId: charlieId, gameId: game1Id, amount: 500 },
      { userId: dianaId, gameId: game1Id, amount: 3000 },
      { userId: aliceId, gameId: game2Id, amount: 1500 },
      { userId: bobId, gameId: game2Id, amount: 1000 },
      { userId: charlieId, gameId: game2Id, amount: 2000 },
    ];

    for (const b of currentBets) {
      await client.query(
        `INSERT INTO point_history (user_id, event_id, game_id, change_amount, reason)
         VALUES ($1, $2, $3, $4, 'bet_placed')`,
        [b.userId, activeEventId, b.gameId, -b.amount]
      );
    }

    // ── debt_history（現在の開催中イベント: Eve の借金賭け）──────────
    await client.query(
      `INSERT INTO debt_history (user_id, event_id, game_id, change_amount, reason)
       VALUES ($1, $2, $3, $4, 'bet_placed')`,
      [eveId, activeEventId, game1Id, pastBetAmount]
    );

    await client.query('COMMIT');
    console.log('✅ シードデータを投入しました。');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ シードデータ投入失敗:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
