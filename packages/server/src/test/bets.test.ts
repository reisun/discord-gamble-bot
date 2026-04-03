import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { pool } from '../db';

const app = createApp();
const ADMIN_TOKEN = 'test-admin-token';
const adminHeaders = { Authorization: `Bearer ${ADMIN_TOKEN}` };
const futureDeadline = new Date(Date.now() + 3600 * 1000).toISOString();
const pastDeadline = new Date(Date.now() - 3600 * 1000).toISOString();

const defaultBetOptions = [
  { symbol: 'A', label: 'チームA' },
  { symbol: 'B', label: 'チームB' },
  { symbol: 'C', label: 'チームC' },
];

async function setupEventAndGame(betType = 'single', requiredSelections?: number) {
  const eventRes = await request(app)
    .post('/api/events')
    .set(adminHeaders)
    .send({ name: 'テストイベント', initialPoints: 10000 });
  const event = eventRes.body.data;

  const gameRes = await request(app)
    .post(`/api/events/${event.id}/games`)
    .set(adminHeaders)
    .send({
      title: '第1試合',
      deadline: futureDeadline,
      betType,
      requiredSelections: requiredSelections ?? null,
      betOptions: defaultBetOptions,
    });
  const game = gameRes.body.data;

  // 公開する
  await request(app)
    .patch(`/api/games/${game.id}/publish`)
    .set(adminHeaders)
    .send({ isPublished: true });

  return { event, game };
}

describe('PUT /api/games/:gameId/bets', () => {
  it('正常に賭けを作成できる（single）', async () => {
    const { game } = await setupEventAndGame();

    const res = await request(app)
      .put(`/api/games/${game.id}/bets`)
      .send({ discordId: 'user001', selectedSymbols: 'A', amount: 500 });

    expect(res.status).toBe(200);
    expect(res.body.data.selectedSymbols).toBe('A');
    expect(res.body.data.amount).toBe(500);
    expect(res.body.data.isDebt).toBe(false);
    expect(res.body.data.isUpdated).toBe(false);
    expect(res.body.data.selectedLabels).toEqual(['チームA']);
  });

  it('同じゲームに再度賭けると上書き（isUpdated: true）', async () => {
    const { game } = await setupEventAndGame();

    await request(app)
      .put(`/api/games/${game.id}/bets`)
      .send({ discordId: 'user001', selectedSymbols: 'A', amount: 300 });

    const res = await request(app)
      .put(`/api/games/${game.id}/bets`)
      .send({ discordId: 'user001', selectedSymbols: 'B', amount: 200 });

    expect(res.status).toBe(200);
    expect(res.body.data.selectedSymbols).toBe('B');
    expect(res.body.data.amount).toBe(200);
    expect(res.body.data.isUpdated).toBe(true);
  });

  it('借金フラグ付きの賭けが作成できる', async () => {
    const { game } = await setupEventAndGame();

    const res = await request(app)
      .put(`/api/games/${game.id}/bets`)
      .send({ discordId: 'user_debt', selectedSymbols: 'A', amount: 999, allowDebt: true });

    expect(res.status).toBe(200);
    expect(res.body.data.isDebt).toBe(true);
    expect(res.body.data.debtAmount).toBe(999);
  });

  it('ポイント不足で allowDebt=false だと 409 を返す', async () => {
    const { game } = await setupEventAndGame();

    const res = await request(app)
      .put(`/api/games/${game.id}/bets`)
      .send({ discordId: 'user_poor', selectedSymbols: 'A', amount: 99999, allowDebt: false });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('締め切り後のゲームは賭けられない', async () => {
    const { game } = await setupEventAndGame();
    await pool.query('UPDATE games SET deadline = $1 WHERE id = $2', [pastDeadline, game.id]);

    const res = await request(app)
      .put(`/api/games/${game.id}/bets`)
      .send({ discordId: 'user001', selectedSymbols: 'A', amount: 100 });

    expect(res.status).toBe(409);
  });

  it('存在しない記号で賭けると 400 を返す', async () => {
    const { game } = await setupEventAndGame();

    const res = await request(app)
      .put(`/api/games/${game.id}/bets`)
      .send({ discordId: 'user001', selectedSymbols: 'Z', amount: 100 });

    expect(res.status).toBe(400);
  });

  it('multi_unordered の記号はソートされて保存される', async () => {
    const { game } = await setupEventAndGame('multi_unordered', 2);

    const res = await request(app)
      .put(`/api/games/${game.id}/bets`)
      .send({ discordId: 'user001', selectedSymbols: 'CA', amount: 100 });

    expect(res.status).toBe(200);
    expect(res.body.data.selectedSymbols).toBe('AC');
  });

  it('multi_ordered で選択数が不一致だと 400 を返す', async () => {
    const { game } = await setupEventAndGame('multi_ordered', 3);

    const res = await request(app)
      .put(`/api/games/${game.id}/bets`)
      .send({ discordId: 'user001', selectedSymbols: 'AB', amount: 100 }); // 3文字必要

    expect(res.status).toBe(400);
  });
});

describe('GET /api/games/:gameId/bets', () => {
  it('賭けが存在する場合に組み合わせと倍率を返す', async () => {
    const { game } = await setupEventAndGame();

    await request(app)
      .put(`/api/games/${game.id}/bets`)
      .send({ discordId: 'user001', selectedSymbols: 'A', amount: 800 });

    await request(app)
      .put(`/api/games/${game.id}/bets`)
      .send({ discordId: 'user002', selectedSymbols: 'B', amount: 200 });

    // 管理者は倍率・人数を見られる
    const adminRes = await request(app)
      .get(`/api/games/${game.id}/bets`)
      .set(adminHeaders);

    expect(adminRes.status).toBe(200);
    const combinations = adminRes.body.data.combinations;
    const combA = combinations.find((c: { selectedSymbols: string }) => c.selectedSymbols === 'A');
    const combB = combinations.find((c: { selectedSymbols: string }) => c.selectedSymbols === 'B');

    // 総1000pt: A=800pt → 1.25倍、B=200pt → 5.00倍
    expect(combA.odds).toBeCloseTo(1.25, 1);
    expect(combB.odds).toBeCloseTo(5.0, 1);
    expect(combA.betCount).toBe(1);
  });

  it('一般ユーザーは結果確定前に倍率を見られない', async () => {
    const { game } = await setupEventAndGame();
    await request(app)
      .put(`/api/games/${game.id}/bets`)
      .send({ discordId: 'user001', selectedSymbols: 'A', amount: 500 });

    const res = await request(app).get(`/api/games/${game.id}/bets`);

    expect(res.status).toBe(200);
    const combinations = res.body.data.combinations;
    expect(combinations[0].odds).toBeNull();
    expect(combinations[0].betCount).toBeUndefined();
  });

  it('結果確定後はパリミュチュエルに基づき当選者にポイントが付与される', async () => {
    const { event, game } = await setupEventAndGame();

    // user001が500pt賭け
    await request(app)
      .put(`/api/games/${game.id}/bets`)
      .send({ discordId: 'user001', selectedSymbols: 'A', amount: 500 });
    // user002が500pt賭け
    await request(app)
      .put(`/api/games/${game.id}/bets`)
      .send({ discordId: 'user002', selectedSymbols: 'B', amount: 500 });

    // 締め切り済みにする
    await pool.query('UPDATE games SET deadline = $1 WHERE id = $2', [pastDeadline, game.id]);

    // A が当選
    await request(app)
      .patch(`/api/games/${game.id}/result`)
      .set(adminHeaders)
      .send({ resultSymbols: 'A' });

    // bets を確認: user001はwin, user002はlose
    const betsRes = await request(app)
      .get(`/api/games/${game.id}/bets`)
      .set(adminHeaders);

    const bets = betsRes.body.data.bets;
    const user001Bet = bets.find((b: { userName: string }) => b.userName === 'user001');
    const user002Bet = bets.find((b: { userName: string }) => b.userName === 'user002');

    expect(user001Bet.result).toBe('win');
    expect(user001Bet.pointChange).toBe(1000); // 500 × (1000/500) = 1000
    expect(user002Bet.result).toBe('lose');
    expect(user002Bet.pointChange).toBe(0);

    // user001のポイントを確認: 10000 - 500 (bet_placed) + 1000 (game_result) = 10500
    const userRes = await request(app)
      .get('/api/users/discord/user001')
      .query({ eventId: event.id });
    expect(userRes.body.data.points).toBe(10500);
  });
});
