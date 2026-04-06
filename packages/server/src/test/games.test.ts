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

async function createEvent() {
  const res = await request(app)
    .post('/api/events')
    .set(adminHeaders)
    .send({ name: 'テストイベント', initialPoints: 10000, guildId: 'test-guild-001' });
  return res.body.data as { id: number };
}

async function createGame(
  eventId: number,
  overrides: Record<string, unknown> = {},
) {
  const res = await request(app)
    .post(`/api/events/${eventId}/games`)
    .set(adminHeaders)
    .send({
      title: '第1試合',
      deadline: futureDeadline,
      betType: 'single',
      betOptions: defaultBetOptions,
      ...overrides,
    });
  return res.body.data as {
    id: number;
    title: string;
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

  it('一般ユーザーは非公開ゲームもプレースホルダー行として取得できる', async () => {
    const event = await createEvent();
    const g = await createGame(event.id);

    // 未公開のまま → 一般にはプレースホルダーで見える
    const res1 = await request(app).get(`/api/events/${event.id}/games`);
    expect(res1.body.data).toHaveLength(1);
    expect(res1.body.data[0].title).toBe('非公開ゲーム');
    expect(res1.body.data[0].isPublished).toBe(false);
    expect(res1.body.data[0].betOptions).toHaveLength(0);

    // 公開する
    await request(app)
      .patch(`/api/games/${g.id}/publish`)
      .set(adminHeaders)
      .send({ isPublished: true });

    const res2 = await request(app).get(`/api/events/${event.id}/games`);
    expect(res2.body.data).toHaveLength(1);
    expect(res2.body.data[0].title).toBe('第1試合');
  });

  it('管理者は includeUnpublished=true で非公開ゲームも取得できる', async () => {
    const event = await createEvent();
    await createGame(event.id); // 未公開

    const res = await request(app)
      .get(`/api/events/${event.id}/games`)
      .query({ includeUnpublished: 'true' })
      .set(adminHeaders);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('POST /api/events/:eventId/games', () => {
  it('single方式のゲームを作成できる', async () => {
    const event = await createEvent();
    const res = await request(app)
      .post(`/api/events/${event.id}/games`)
      .set(adminHeaders)
      .send({
        title: '第1試合',
        description: '説明文',
        deadline: futureDeadline,
        betType: 'single',
        betOptions: defaultBetOptions,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.betType).toBe('single');
    expect(res.body.data.betOptions).toHaveLength(3);
    expect(res.body.data.status).toBe('open');
  });

  it('複数方式(multi_ordered)のゲームを作成できる', async () => {
    const event = await createEvent();
    const res = await request(app)
      .post(`/api/events/${event.id}/games`)
      .set(adminHeaders)
      .send({
        title: '3連単試合',
        deadline: futureDeadline,
        betType: 'multi_ordered',
        requiredSelections: 3,
        betOptions: defaultBetOptions,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.betType).toBe('multi_ordered');
    expect(res.body.data.requiredSelections).toBe(3);
  });

  it('締め切りが過去だと 400 を返す', async () => {
    const event = await createEvent();
    const res = await request(app)
      .post(`/api/events/${event.id}/games`)
      .set(adminHeaders)
      .send({
        title: '試合',
        deadline: pastDeadline,
        betOptions: defaultBetOptions,
      });
    expect(res.status).toBe(400);
  });

  it('賭け項目が1つだと 400 を返す', async () => {
    const event = await createEvent();
    const res = await request(app)
      .post(`/api/events/${event.id}/games`)
      .set(adminHeaders)
      .send({
        title: '試合',
        deadline: futureDeadline,
        betOptions: [{ symbol: 'A', label: 'チームA' }],
      });
    expect(res.status).toBe(400);
  });

  it('記号が重複していると 400 を返す', async () => {
    const event = await createEvent();
    const res = await request(app)
      .post(`/api/events/${event.id}/games`)
      .set(adminHeaders)
      .send({
        title: '試合',
        deadline: futureDeadline,
        betOptions: [
          { symbol: 'A', label: 'チームA' },
          { symbol: 'A', label: 'チームA2' },
        ],
      });
    expect(res.status).toBe(400);
  });

  it('multi方式で賭け項目数が選択数未満だと 400 を返す', async () => {
    const event = await createEvent();
    const res = await request(app)
      .post(`/api/events/${event.id}/games`)
      .set(adminHeaders)
      .send({
        title: '試合',
        deadline: futureDeadline,
        betType: 'multi_ordered',
        requiredSelections: 3,
        betOptions: [
          { symbol: 'A', label: 'A' },
          { symbol: 'B', label: 'B' },
        ],
      });
    expect(res.status).toBe(400);
  });

  it('存在しないイベントIDだと 404 を返す', async () => {
    const res = await request(app)
      .post('/api/events/9999/games')
      .set(adminHeaders)
      .send({
        title: '試合',
        deadline: futureDeadline,
        betOptions: defaultBetOptions,
      });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/games/:id', () => {
  it('ゲーム詳細を返す', async () => {
    const event = await createEvent();
    const game = await createGame(event.id);

    await request(app)
      .patch(`/api/games/${game.id}/publish`)
      .set(adminHeaders)
      .send({ isPublished: true });

    const res = await request(app).get(`/api/games/${game.id}`);
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

  it('存在しないIDだと 404 を返す', async () => {
    const res = await request(app).get('/api/games/9999');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/games/:id', () => {
  it('未公開ゲームはすべてのフィールドを更新できる', async () => {
    const event = await createEvent();
    const game = await createGame(event.id);

    const newDeadline = new Date(Date.now() + 7200 * 1000).toISOString();
    const res = await request(app)
      .put(`/api/games/${game.id}`)
      .set(adminHeaders)
      .send({
        title: '第1試合（更新）',
        deadline: newDeadline,
        betOptions: [
          { symbol: 'X', label: 'チームX' },
          { symbol: 'Y', label: 'チームY' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('第1試合（更新）');
    expect(res.body.data.betOptions).toHaveLength(2);
    expect(res.body.data.betOptions[0].symbol).toBe('X');
  });

  it('公開済みゲームでも deadline を変更できる', async () => {
    const event = await createEvent();
    const game = await createGame(event.id);
    await request(app)
      .patch(`/api/games/${game.id}/publish`)
      .set(adminHeaders)
      .send({ isPublished: true });

    const newDeadline = new Date(Date.now() + 7200 * 1000).toISOString();
    const res = await request(app)
      .put(`/api/games/${game.id}`)
      .set(adminHeaders)
      .send({ deadline: newDeadline });

    expect(res.status).toBe(200);
    expect(new Date(res.body.data.deadline).toISOString()).toBe(newDeadline);
  });

  it('公開済みゲームでも label は変更できる', async () => {
    const event = await createEvent();
    const game = await createGame(event.id);
    await request(app)
      .patch(`/api/games/${game.id}/publish`)
      .set(adminHeaders)
      .send({ isPublished: true });

    const res = await request(app)
      .put(`/api/games/${game.id}`)
      .set(adminHeaders)
      .send({
        betOptions: [
          { symbol: 'A', label: 'チームA（改）' },
          { symbol: 'B', label: 'チームB（改）' },
          { symbol: 'C', label: 'チームC（改）' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.betOptions[0].label).toBe('チームA（改）');
    expect(res.body.data.betOptions[0].symbol).toBe('A');
  });
});

describe('DELETE /api/games/:id', () => {
  it('正常に削除できる', async () => {
    const event = await createEvent();
    const game = await createGame(event.id);

    const deleteRes = await request(app)
      .delete(`/api/games/${game.id}`)
      .set(adminHeaders);
    expect(deleteRes.status).toBe(204);

    const getRes = await request(app).get(`/api/games/${game.id}`);
    expect(getRes.status).toBe(404);
  });

  it('公開済みかつ締め切り前のゲームは削除できない', async () => {
    const event = await createEvent();
    const game = await createGame(event.id);
    await request(app)
      .patch(`/api/games/${game.id}/publish`)
      .set(adminHeaders)
      .send({ isPublished: true });

    const res = await request(app)
      .delete(`/api/games/${game.id}`)
      .set(adminHeaders);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('公開済みでも締め切り後のゲームは削除できる', async () => {
    const event = await createEvent();
    const game = await createGame(event.id);
    await request(app)
      .patch(`/api/games/${game.id}/publish`)
      .set(adminHeaders)
      .send({ isPublished: true });
    await pool.query('UPDATE games SET deadline = $1 WHERE id = $2', [pastDeadline, game.id]);

    const deleteRes = await request(app)
      .delete(`/api/games/${game.id}`)
      .set(adminHeaders);

    expect(deleteRes.status).toBe(204);
  });
});

describe('PATCH /api/games/:id/publish', () => {
  it('公開・非公開を切り替えられる', async () => {
    const event = await createEvent();
    const game = await createGame(event.id);

    const res1 = await request(app)
      .patch(`/api/games/${game.id}/publish`)
      .set(adminHeaders)
      .send({ isPublished: true });

    expect(res1.status).toBe(200);
    expect(res1.body.data.isPublished).toBe(true);

    const res2 = await request(app)
      .patch(`/api/games/${game.id}/publish`)
      .set(adminHeaders)
      .send({ isPublished: false });

    expect(res2.status).toBe(200);
    expect(res2.body.data.isPublished).toBe(false);
  });
});

describe('PATCH /api/games/:id/result', () => {
  it('締め切り後のゲームに結果を設定できる（単数方式）', async () => {
    const event = await createEvent();
    // 締め切り済みゲームを直接DBに作成（過去deadline）
    const res = await request(app)
      .post(`/api/events/${event.id}/games`)
      .set(adminHeaders)
      .send({
        title: '締め切り試合',
        deadline: futureDeadline,
        betOptions: defaultBetOptions,
      });
    const game = res.body.data;

    // deadlineを過去に変更するため直接DBを操作
    await pool.query('UPDATE games SET deadline = $1 WHERE id = $2', [
      pastDeadline,
      game.id,
    ]);

    const resultRes = await request(app)
      .patch(`/api/games/${game.id}/result`)
      .set(adminHeaders)
      .send({ resultSymbols: 'A' });

    expect(resultRes.status).toBe(200);
    expect(resultRes.body.data.resultSymbols).toBe('A');
    expect(resultRes.body.data.status).toBe('finished');
  });

  it('受付中ゲームへの結果確定は 409 を返す', async () => {
    const event = await createEvent();
    const game = await createGame(event.id);

    const res = await request(app)
      .patch(`/api/games/${game.id}/result`)
      .set(adminHeaders)
      .send({ resultSymbols: 'A' });

    expect(res.status).toBe(409);
  });

  it('存在しない記号を指定すると 400 を返す', async () => {
    const event = await createEvent();
    const game = await createGame(event.id);

    await pool.query('UPDATE games SET deadline = $1 WHERE id = $2', [pastDeadline, game.id]);

    const res = await request(app)
      .patch(`/api/games/${game.id}/result`)
      .set(adminHeaders)
      .send({ resultSymbols: 'Z' });

    expect(res.status).toBe(400);
  });

  it('multi_unordered の結果はソートされて保存される', async () => {
    const event = await createEvent();
    const game = await createGame(event.id, {
      betType: 'multi_unordered',
      requiredSelections: 2,
    });

    await pool.query('UPDATE games SET deadline = $1 WHERE id = $2', [pastDeadline, game.id]);

    const res = await request(app)
      .patch(`/api/games/${game.id}/result`)
      .set(adminHeaders)
      .send({ resultSymbols: 'CA' }); // ソートされて 'AC' になるはず

    expect(res.status).toBe(200);
    expect(res.body.data.resultSymbols).toBe('AC');
  });
});
