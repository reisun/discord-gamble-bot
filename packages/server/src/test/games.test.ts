import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { pool } from '../db';

const app = createApp();
const pastDeadline = new Date(Date.now() - 3600 * 1000).toISOString();

/** DB editor トークンを生成する */
async function createDbToken(role: 'editor' | 'viewer' = 'editor', guildId = 'test-guild-001') {
  const res = await request(app)
    .post('/internal/api/auth/token')
    .send({ guildId, role });
  return res.body.data.token as string;
}

const defaultBetOptions = [
  { symbol: 'A', label: 'チームA' },
  { symbol: 'B', label: 'チームB' },
  { symbol: 'C', label: 'チームC' },
];

async function createEvent() {
  const token = await createDbToken();
  const res = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'テストイベント', initialPoints: 10000, guildId: 'test-guild-001' });
  return res.body.data as { id: number };
}

async function createGame(eventId: number, overrides: Record<string, unknown> = {}) {
  const token = await createDbToken();
  const res = await request(app)
    .post(`/api/events/${eventId}/games`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: '第1試合',
      closeAfterMinutes: 10,
      betType: 'single',
      betOptions: defaultBetOptions,
      ...overrides,
    });
  return res.body.data as {
    id: number;
    title: string;
    deadline: string;
    closeAfterMinutes: number;
    status: string;
    isPublished: boolean;
    betType: string;
    betOptions: { symbol: string; label: string; order: number }[];
  };
}

describe('GET /api/events/:eventId/games', () => {
  it('存在しないイベントだと 404 を返す', async () => {
    const res = await request(app).get('/api/events/9999/games');
    expect(res.status).toBe(404);
  });

  it('一般ユーザーは非公開ゲームをプレースホルダーで取得できる', async () => {
    const event = await createEvent();
    const game = await createGame(event.id, { closeAfterMinutes: 15 });

    const res = await request(app).get(`/api/events/${event.id}/games`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(game.id);
    expect(res.body.data[0].title).toBe('非公開ゲーム');
    expect(res.body.data[0].closeAfterMinutes).toBe(15);
    expect(res.body.data[0].betOptions).toHaveLength(0);
  });

  it('管理者は includeUnpublished=true で非公開ゲームの実データを取得できる', async () => {
    const event = await createEvent();
    await createGame(event.id);

    const token = await createDbToken();
    const res = await request(app)
      .get(`/api/events/${event.id}/games`)
      .query({ includeUnpublished: 'true' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].title).toBe('第1試合');
  });
});

describe('POST /api/events/:eventId/games', () => {
  it('single方式のゲームを作成できる', async () => {
    const event = await createEvent();
    const token = await createDbToken();
    const res = await request(app)
      .post(`/api/events/${event.id}/games`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '第1試合',
        description: '説明文',
        closeAfterMinutes: 12,
        betType: 'single',
        betOptions: defaultBetOptions,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.betType).toBe('single');
    expect(res.body.data.closeAfterMinutes).toBe(12);
    expect(res.body.data.betOptions).toHaveLength(3);
    expect(res.body.data.status).toBe('open');
  });

  it('closeAfterMinutes 未指定時は 10 分が入る', async () => {
    const event = await createEvent();
    const token = await createDbToken();
    const res = await request(app)
      .post(`/api/events/${event.id}/games`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '第1試合',
        betOptions: defaultBetOptions,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.closeAfterMinutes).toBe(10);
  });

  it('deadline を直接指定すると 400 を返す', async () => {
    const event = await createEvent();
    const token = await createDbToken();
    const res = await request(app)
      .post(`/api/events/${event.id}/games`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '第1試合',
        deadline: new Date().toISOString(),
        betOptions: defaultBetOptions,
      });

    expect(res.status).toBe(400);
  });

  it('closeAfterMinutes が 0 だと 400 を返す', async () => {
    const event = await createEvent();
    const token = await createDbToken();
    const res = await request(app)
      .post(`/api/events/${event.id}/games`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '第1試合',
        closeAfterMinutes: 0,
        betOptions: defaultBetOptions,
      });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/games/:id', () => {
  it('ゲーム詳細を返す', async () => {
    const event = await createEvent();
    const game = await createGame(event.id);

    const token = await createDbToken();
    await request(app)
      .patch(`/api/games/${game.id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isPublished: true });

    const res = await request(app)
      .get(`/api/games/${game.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(game.id);
    expect(res.body.data.betOptions).toHaveLength(3);
  });

  it('一般ユーザーは非公開ゲーム詳細を取得できない', async () => {
    const event = await createEvent();
    const game = await createGame(event.id);

    const res = await request(app).get(`/api/games/${game.id}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/games/:id', () => {
  it('未公開ゲームは closeAfterMinutes を更新できる', async () => {
    const event = await createEvent();
    const game = await createGame(event.id, { closeAfterMinutes: 10 });

    const token = await createDbToken();
    const res = await request(app)
      .put(`/api/games/${game.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '第1試合（更新）',
        closeAfterMinutes: 25,
        betOptions: [
          { symbol: 'X', label: 'チームX' },
          { symbol: 'Y', label: 'チームY' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('第1試合（更新）');
    expect(res.body.data.closeAfterMinutes).toBe(25);
    expect(res.body.data.betOptions[0].symbol).toBe('X');
  });

  it('公開済みゲームは closeAfterMinutes を更新できない', async () => {
    const event = await createEvent();
    const game = await createGame(event.id);
    const token = await createDbToken();
    await request(app)
      .patch(`/api/games/${game.id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isPublished: true });

    const res = await request(app)
      .put(`/api/games/${game.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ closeAfterMinutes: 20 });

    expect(res.status).toBe(409);
  });

  it('deadline を直接更新しようとすると 400 を返す', async () => {
    const event = await createEvent();
    const game = await createGame(event.id);

    const token = await createDbToken();
    const res = await request(app)
      .put(`/api/games/${game.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ deadline: new Date().toISOString() });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/games/:id', () => {
  it('未公開ゲームは削除できる', async () => {
    const event = await createEvent();
    const game = await createGame(event.id);

    const token = await createDbToken();
    const deleteRes = await request(app)
      .delete(`/api/games/${game.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(204);
  });

  it('公開済みかつ締め切り前のゲームは削除できない', async () => {
    const event = await createEvent();
    const game = await createGame(event.id);
    const token = await createDbToken();
    await request(app)
      .patch(`/api/games/${game.id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isPublished: true });

    const deleteRes = await request(app)
      .delete(`/api/games/${game.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(409);
  });
});

describe('PATCH /api/games/:id/publish', () => {
  it('公開時に deadline を closeAfterMinutes 後へ更新する', async () => {
    const event = await createEvent();
    const game = await createGame(event.id, { closeAfterMinutes: 15 });

    const token = await createDbToken();
    const before = Date.now();
    const res = await request(app)
      .patch(`/api/games/${game.id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isPublished: true });
    const after = Date.now();

    expect(res.status).toBe(200);
    expect(res.body.data.isPublished).toBe(true);
    const deadline = new Date(res.body.data.deadline).getTime();
    expect(deadline).toBeGreaterThanOrEqual(before + 14 * 60 * 1000);
    expect(deadline).toBeLessThanOrEqual(after + 16 * 60 * 1000);
  });
});

describe('PATCH /api/games/:id/close-now', () => {
  it('公開済みゲームを即時締め切りできる', async () => {
    const event = await createEvent();
    const game = await createGame(event.id);
    const token = await createDbToken();
    await request(app)
      .patch(`/api/games/${game.id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isPublished: true });

    const res = await request(app)
      .patch(`/api/games/${game.id}/close-now`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('closed');
  });
});

describe('PATCH /api/games/:id/result', () => {
  it('締め切り後のゲームに結果を設定できる', async () => {
    const event = await createEvent();
    const game = await createGame(event.id);
    const token = await createDbToken();
    await request(app)
      .patch(`/api/games/${game.id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isPublished: true });

    await pool.query('UPDATE games SET deadline = $1 WHERE id = $2', [pastDeadline, game.id]);

    const resultRes = await request(app)
      .patch(`/api/games/${game.id}/result`)
      .set('Authorization', `Bearer ${token}`)
      .send({ resultSymbols: 'A' });

    expect(resultRes.status).toBe(200);
    expect(resultRes.body.data.resultSymbols).toBe('A');
    expect(resultRes.body.data.status).toBe('finished');
  });
});
