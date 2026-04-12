import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { pool } from '../db';

const app = createApp();
const pastDeadline = new Date(Date.now() - 3600 * 1000).toISOString();

const defaultBetOptions = [
  { symbol: 'A', label: 'チームA' },
  { symbol: 'B', label: 'チームB' },
];

/** DB editor トークンを生成する */
async function createDbToken(role: 'editor' | 'viewer' = 'editor', guildId = 'test-guild-001') {
  const res = await request(app)
    .post('/internal/api/auth/token')
    .send({ guildId, role });
  return res.body.data.token as string;
}

/** イベント・ゲームを作成してユーザーに賭けをさせるシナリオヘルパー */
async function setupFullScenario() {
  const token = await createDbToken();

  const eventRes = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'テストイベント', initialPoints: 10000, guildId: 'test-guild-001' });
  const event = eventRes.body.data;

  const gameRes = await request(app)
    .post(`/api/events/${event.id}/games`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: '第1試合',
      closeAfterMinutes: 10,
      betOptions: defaultBetOptions,
    });
  const game = gameRes.body.data;

  await request(app)
    .patch(`/api/games/${game.id}/publish`)
    .set('Authorization', `Bearer ${token}`)
    .send({ isPublished: true });

  // user001: 500pt賭け (A選択)
  await request(app)
    .put(`/api/games/${game.id}/bets`)
    .send({ discordId: 'user001', selectedSymbols: 'A', amount: 500 });

  // user002: 300pt賭け (B選択)
  await request(app)
    .put(`/api/games/${game.id}/bets`)
    .send({ discordId: 'user002', selectedSymbols: 'B', amount: 300 });

  return { event, game };
}

describe('GET /api/users', () => {
  it('eventId なしだと 400 を返す', async () => {
    const token = await createDbToken();
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('不正トークンで 401 を返す', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', 'Bearer wrong-token')
      .query({ eventId: '1' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('賭けを行ったユーザーのポイントが反映される', async () => {
    const { event } = await setupFullScenario();

    const token = await createDbToken();
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .query({ eventId: event.id });

    expect(res.status).toBe(200);
    const users = res.body.data;
    expect(users).toHaveLength(2);

    const u1 = users.find((u: { discordId: string }) => u.discordId === 'user001');
    expect(u1.points).toBe(9500); // 10000 - 500
  });

  it('管理者は debt フィールドを受け取る', async () => {
    const { event } = await setupFullScenario();

    const token = await createDbToken();
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .query({ eventId: event.id });

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toHaveProperty('debt');
  });

  it('viewer トークンは debt フィールドを受け取らない', async () => {
    const { event } = await setupFullScenario();

    // viewer トークンを生成
    const viewerToken = await createDbToken('viewer');

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${viewerToken}`)
      .query({ eventId: event.id });

    expect(res.status).toBe(200);
    expect(res.body.data[0]).not.toHaveProperty('debt');
  });
});

describe('GET /api/users/discord/:discordId', () => {
  it('Discord ID でユーザーを取得できる', async () => {
    const { event } = await setupFullScenario();

    const token = await createDbToken();
    const res = await request(app)
      .get('/api/users/discord/user001')
      .set('Authorization', `Bearer ${token}`)
      .query({ eventId: event.id });

    expect(res.status).toBe(200);
    expect(res.body.data.discordId).toBe('user001');
    expect(res.body.data.points).toBe(9500);
  });

  it('存在しない Discord ID だと 404 を返す', async () => {
    const token = await createDbToken();
    const res = await request(app)
      .get('/api/users/discord/nobody')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('不正トークンで 401 を返す', async () => {
    const res = await request(app)
      .get('/api/users/discord/user001')
      .set('Authorization', 'Bearer wrong-token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });
});

describe('GET /api/users/:id', () => {
  it('ユーザー詳細を返す', async () => {
    const { event } = await setupFullScenario();

    const token = await createDbToken();
    const listRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .query({ eventId: event.id });
    const user = listRes.body.data[0];

    const res = await request(app)
      .get(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .query({ eventId: event.id });

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(user.id);
    expect(res.body.data.points).toBeDefined();
  });

  it('不正トークンで 401 を返す', async () => {
    const res = await request(app)
      .get('/api/users/1')
      .set('Authorization', 'Bearer wrong-token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });
});

describe('GET /api/users/:id/event-bets/:eventId', () => {
  it('イベント内の賭け一覧を返す', async () => {
    const { event } = await setupFullScenario();

    const token = await createDbToken();
    const listRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .query({ eventId: event.id });
    const user = listRes.body.data.find(
      (u: { discordId: string }) => u.discordId === 'user001',
    );

    const res = await request(app)
      .get(`/api/users/${user.id}/event-bets/${event.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.eventId).toBe(event.id);
    expect(res.body.data.currentPoints).toBe(9500);
    expect(res.body.data.bets).toHaveLength(1);
    expect(res.body.data.bets[0].selectedSymbols).toBe('A');
    expect(res.body.data.bets[0].amount).toBe(500);
    expect(res.body.data.bets[0].result).toBeNull(); // まだ結果未確定
  });

  it('結果確定後は odds・pointChange が含まれる', async () => {
    const { event, game } = await setupFullScenario();

    const token = await createDbToken();
    await pool.query('UPDATE games SET deadline = $1 WHERE id = $2', [pastDeadline, game.id]);
    await request(app)
      .patch(`/api/games/${game.id}/result`)
      .set('Authorization', `Bearer ${token}`)
      .send({ resultSymbols: 'A' });

    const listRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .query({ eventId: event.id });
    const user = listRes.body.data.find(
      (u: { discordId: string }) => u.discordId === 'user001',
    );

    const res = await request(app)
      .get(`/api/users/${user.id}/event-bets/${event.id}`)
      .set('Authorization', `Bearer ${token}`);

    const bet = res.body.data.bets[0];
    expect(bet.result).toBe('win');
    // 総800pt, A=500pt → 1.6倍 → 500 × 1.6 = 800
    expect(bet.pointChange).toBe(800);
  });
});

describe('GET /api/users/:id/event-results/:eventId', () => {
  it('resultsPublic=false かつ非管理者だと 403 を返す', async () => {
    const { event } = await setupFullScenario();

    const token = await createDbToken();
    const listRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .query({ eventId: event.id });
    const user = listRes.body.data[0];

    // viewer トークンで試みる
    const viewerToken = await createDbToken('viewer');

    const res = await request(app)
      .get(`/api/users/${user.id}/event-results/${event.id}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(403);
  });

  it('管理者はイベント別結果を取得できる', async () => {
    const { event, game } = await setupFullScenario();

    const token = await createDbToken();
    await pool.query('UPDATE games SET deadline = $1 WHERE id = $2', [pastDeadline, game.id]);
    await request(app)
      .patch(`/api/games/${game.id}/result`)
      .set('Authorization', `Bearer ${token}`)
      .send({ resultSymbols: 'A' });

    const listRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .query({ eventId: event.id });
    const user = listRes.body.data.find(
      (u: { discordId: string }) => u.discordId === 'user001',
    );

    const res = await request(app)
      .get(`/api/users/${user.id}/event-results/${event.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.wins).toBe(1);
    expect(res.body.data.losses).toBe(0);
    expect(res.body.data.games).toHaveLength(1);
    expect(res.body.data.games[0].result).toBe('win');
    expect(res.body.data.games[0].pointChange).toBe(800);
  });

  it('resultsPublic=true なら一般ユーザーも閲覧できる', async () => {
    const { event } = await setupFullScenario();

    // resultsPublic を有効化
    const token = await createDbToken();
    await request(app)
      .put(`/api/events/${event.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ resultsPublic: true });

    const listRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .query({ eventId: event.id });
    const user = listRes.body.data[0];

    // viewer トークンで試みる
    const viewerToken = await createDbToken('viewer');

    const res = await request(app)
      .get(`/api/users/${user.id}/event-results/${event.id}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/users/:id/point-history', () => {
  it('ポイント履歴を返す', async () => {
    const { event } = await setupFullScenario();

    const token = await createDbToken();
    const listRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .query({ eventId: event.id });
    const user = listRes.body.data.find(
      (u: { discordId: string }) => u.discordId === 'user001',
    );

    const res = await request(app)
      .get(`/api/users/${user.id}/point-history`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // bet_placed が1件あるはず
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    const betPlaced = res.body.data.find(
      (h: { reason: string }) => h.reason === 'bet_placed',
    );
    expect(betPlaced.changeAmount).toBe(-500);
  });
});
