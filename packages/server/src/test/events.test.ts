import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

const TEST_GUILD_ID = 'test-guild-001';

/** 内部 API 経由で DB トークンを生成する */
async function createDbToken(role: 'editor' | 'viewer' = 'editor', guildId = TEST_GUILD_ID) {
  const res = await request(app).post('/internal/api/auth/token').send({ guildId, role });
  return res.body.data.token as string;
}

/** イベントを1件作成してそのデータを返すヘルパー */
async function createEvent(name = 'テストイベント', initialPoints = 10000) {
  const token = await createDbToken();
  const res = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${token}`)
    .send({ name, initialPoints, guildId: TEST_GUILD_ID });
  return {
    ...(res.body.data as {
      id: number;
      name: string;
      isActive: boolean;
      isPublished: boolean;
      initialPoints: number;
    }),
    token,
  };
}

describe('GET /api/events', () => {
  it('guildId なしは 400 を返す', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('空の場合は空配列を返す', async () => {
    const res = await request(app).get(`/api/events?guildId=${TEST_GUILD_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('管理者は全イベント（非公開含む）を返す', async () => {
    const { token } = await createEvent('大会A');
    await createEvent('大会B');

    const res = await request(app)
      .get(`/api/events?guildId=${TEST_GUILD_ID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].name).toBe('大会A');
    expect(res.body.data[1].name).toBe('大会B');
  });

  it('一般ユーザーは公開イベントのみ返す', async () => {
    const { id, token } = await createEvent('公開大会');
    await createEvent('非公開大会');

    // e1 のみ公開にする
    await request(app)
      .patch(`/api/events/${id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isPublished: true });

    const res = await request(app).get(`/api/events?guildId=${TEST_GUILD_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('公開大会');
  });

  it('レスポンスに isPublished と guildId が含まれる', async () => {
    const { token } = await createEvent('大会X');
    const res = await request(app)
      .get(`/api/events?guildId=${TEST_GUILD_ID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toHaveProperty('isPublished', false);
    expect(res.body.data[0]).toHaveProperty('guildId', TEST_GUILD_ID);
  });
});

describe('GET /api/events/:id', () => {
  it('存在するイベントを返す', async () => {
    const { id } = await createEvent('大会X', 5000);

    const res = await request(app).get(`/api/events/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('大会X');
    expect(res.body.data.initialPoints).toBe(5000);
    expect(res.body.data.isActive).toBe(false);
    expect(res.body.data.isPublished).toBe(false);
  });

  it('存在しない場合は 404 を返す', async () => {
    const res = await request(app).get('/api/events/9999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/events', () => {
  it('正常に作成できる', async () => {
    const token = await createDbToken();
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '新しい大会', initialPoints: 8000, guildId: TEST_GUILD_ID });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('新しい大会');
    expect(res.body.data.guildId).toBe(TEST_GUILD_ID);
    expect(res.body.data.initialPoints).toBe(8000);
    expect(res.body.data.isActive).toBe(false);
    expect(res.body.data.isPublished).toBe(false);
    expect(res.body.data.resultsPublic).toBe(false);
  });

  it('initialPoints を省略すると 10000 がデフォルト', async () => {
    const token = await createDbToken();
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'デフォルトPT大会', guildId: TEST_GUILD_ID });

    expect(res.status).toBe(201);
    expect(res.body.data.initialPoints).toBe(10000);
  });

  it('guildId がないと 400 を返す', async () => {
    const token = await createDbToken();
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '大会' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('name が空文字列だと 400 を返す', async () => {
    const token = await createDbToken();
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '', guildId: TEST_GUILD_ID });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('name が 100 文字超だと 400 を返す', async () => {
    const token = await createDbToken();
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'a'.repeat(101), guildId: TEST_GUILD_ID });

    expect(res.status).toBe(400);
  });

  it('initialPoints が 0 だと 400 を返す', async () => {
    const token = await createDbToken();
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '大会', initialPoints: 0, guildId: TEST_GUILD_ID });

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/events/:id', () => {
  it('正常に更新できる', async () => {
    const { id, token } = await createEvent('旧名称');

    const res = await request(app)
      .put(`/api/events/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '新名称', initialPoints: 500 });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('新名称');
    expect(res.body.data.initialPoints).toBe(500);
  });

  it('存在しないIDだと 404 を返す', async () => {
    const token = await createDbToken();
    const res = await request(app)
      .put('/api/events/9999')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '存在しない' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/events/:id', () => {
  it('正常に削除できる', async () => {
    const { id, token } = await createEvent();

    const deleteRes = await request(app)
      .delete(`/api/events/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(204);

    const getRes = await request(app).get(`/api/events/${id}`);
    expect(getRes.status).toBe(404);
  });

  it('存在しないIDだと 404 を返す', async () => {
    const token = await createDbToken();
    const res = await request(app)
      .delete('/api/events/9999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/events/:id/activate', () => {
  it('非開催→開催: 他を非開催にし、対象を開催中にする', async () => {
    const { id: e1Id, token } = await createEvent('大会1');
    const { id: e2Id } = await createEvent('大会2');

    await request(app)
      .patch(`/api/events/${e1Id}/activate`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .patch(`/api/events/${e2Id}/activate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(true);

    const e1Res = await request(app).get(`/api/events/${e1Id}`);
    expect(e1Res.body.data.isActive).toBe(false);
  });

  it('非開催→開催: is_published が TRUE に強制される', async () => {
    const { id, isPublished, token } = await createEvent('大会');
    expect(isPublished).toBe(false);

    const res = await request(app)
      .patch(`/api/events/${id}/activate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.isPublished).toBe(true);
  });

  it('開催中→非開催: トグルで非開催になる（開催0件を許容）', async () => {
    const { id, token } = await createEvent('大会');

    await request(app).patch(`/api/events/${id}/activate`).set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .patch(`/api/events/${id}/activate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });

  it('存在しないIDだと 404 を返す', async () => {
    const token = await createDbToken();
    const res = await request(app)
      .patch('/api/events/9999/activate')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/events/:id/publish', () => {
  it('非公開→公開に切り替えられる', async () => {
    const { id, token } = await createEvent('大会');

    const res = await request(app)
      .patch(`/api/events/${id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isPublished: true });

    expect(res.status).toBe(200);
    expect(res.body.data.isPublished).toBe(true);
  });

  it('公開→非公開に切り替えられる', async () => {
    const { id, token } = await createEvent('大会');
    await request(app)
      .patch(`/api/events/${id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isPublished: true });

    const res = await request(app)
      .patch(`/api/events/${id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isPublished: false });

    expect(res.status).toBe(200);
    expect(res.body.data.isPublished).toBe(false);
  });

  it('開催中のイベントを非公開にしようとすると 400 を返す', async () => {
    const { id, token } = await createEvent('大会');
    await request(app).patch(`/api/events/${id}/activate`).set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .patch(`/api/events/${id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isPublished: false });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_OPERATION');
  });

  it('isPublished が boolean でない場合は 400 を返す', async () => {
    const { id, token } = await createEvent('大会');

    const res = await request(app)
      .patch(`/api/events/${id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isPublished: 'yes' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('存在しないIDだと 404 を返す', async () => {
    const token = await createDbToken();
    const res = await request(app)
      .patch('/api/events/9999/publish')
      .set('Authorization', `Bearer ${token}`)
      .send({ isPublished: true });
    expect(res.status).toBe(404);
  });

  it('viewer トークンは 403 を返す', async () => {
    const { id } = await createEvent('大会');
    const viewerToken = await createDbToken('viewer');

    const res = await request(app)
      .patch(`/api/events/${id}/publish`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ isPublished: true });

    expect(res.status).toBe(403);
  });
});
