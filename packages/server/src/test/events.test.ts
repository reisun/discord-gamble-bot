import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

const app = createApp();
const ADMIN_TOKEN = 'test-admin-token';
const adminHeaders = { Authorization: `Bearer ${ADMIN_TOKEN}` };

/** イベントを1件作成してそのデータを返すヘルパー */
async function createEvent(name = 'テストイベント', initialPoints = 10000) {
  const res = await request(app)
    .post('/api/events')
    .set(adminHeaders)
    .send({ name, initialPoints });
  return res.body.data as { id: number; name: string; isActive: boolean; initialPoints: number };
}

describe('GET /api/events', () => {
  it('空の場合は空配列を返す', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('イベントが存在する場合は一覧を返す', async () => {
    await createEvent('大会A');
    await createEvent('大会B');

    const res = await request(app).get('/api/events');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].name).toBe('大会A');
    expect(res.body.data[1].name).toBe('大会B');
  });
});

describe('GET /api/events/:id', () => {
  it('存在するイベントを返す', async () => {
    const created = await createEvent('大会X', 5000);

    const res = await request(app).get(`/api/events/${created.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('大会X');
    expect(res.body.data.initialPoints).toBe(5000);
    expect(res.body.data.isActive).toBe(false);
  });

  it('存在しない場合は 404 を返す', async () => {
    const res = await request(app).get('/api/events/9999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/events', () => {
  it('正常に作成できる', async () => {
    const res = await request(app)
      .post('/api/events')
      .set(adminHeaders)
      .send({ name: '新しい大会', initialPoints: 8000 });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('新しい大会');
    expect(res.body.data.initialPoints).toBe(8000);
    expect(res.body.data.isActive).toBe(false);
    expect(res.body.data.resultsPublic).toBe(false);
  });

  it('initialPoints を省略すると 10000 がデフォルト', async () => {
    const res = await request(app)
      .post('/api/events')
      .set(adminHeaders)
      .send({ name: 'デフォルトPT大会' });

    expect(res.status).toBe(201);
    expect(res.body.data.initialPoints).toBe(10000);
  });

  it('name が空文字列だと 400 を返す', async () => {
    const res = await request(app)
      .post('/api/events')
      .set(adminHeaders)
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('name が 100 文字超だと 400 を返す', async () => {
    const res = await request(app)
      .post('/api/events')
      .set(adminHeaders)
      .send({ name: 'a'.repeat(101) });

    expect(res.status).toBe(400);
  });

  it('initialPoints が 0 だと 400 を返す', async () => {
    const res = await request(app)
      .post('/api/events')
      .set(adminHeaders)
      .send({ name: '大会', initialPoints: 0 });

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/events/:id', () => {
  it('正常に更新できる', async () => {
    const created = await createEvent('旧名称');

    const res = await request(app)
      .put(`/api/events/${created.id}`)
      .set(adminHeaders)
      .send({ name: '新名称', initialPoints: 500 });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('新名称');
    expect(res.body.data.initialPoints).toBe(500);
  });

  it('存在しないIDだと 404 を返す', async () => {
    const res = await request(app)
      .put('/api/events/9999')
      .set(adminHeaders)
      .send({ name: '存在しない' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/events/:id', () => {
  it('正常に削除できる', async () => {
    const created = await createEvent();

    const deleteRes = await request(app)
      .delete(`/api/events/${created.id}`)
      .set(adminHeaders);
    expect(deleteRes.status).toBe(204);

    const getRes = await request(app).get(`/api/events/${created.id}`);
    expect(getRes.status).toBe(404);
  });

  it('存在しないIDだと 404 を返す', async () => {
    const res = await request(app)
      .delete('/api/events/9999')
      .set(adminHeaders);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/events/:id/activate', () => {
  it('指定イベントを開催中にし、他を非開催にする', async () => {
    const e1 = await createEvent('大会1');
    const e2 = await createEvent('大会2');

    // e1 を開催中に
    await request(app)
      .patch(`/api/events/${e1.id}/activate`)
      .set(adminHeaders);

    // e2 を開催中に（e1 は非開催になるはず）
    const res = await request(app)
      .patch(`/api/events/${e2.id}/activate`)
      .set(adminHeaders);

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(true);

    const e1Res = await request(app).get(`/api/events/${e1.id}`);
    expect(e1Res.body.data.isActive).toBe(false);
  });

  it('存在しないIDだと 404 を返す', async () => {
    const res = await request(app)
      .patch('/api/events/9999/activate')
      .set(adminHeaders);
    expect(res.status).toBe(404);
  });
});
