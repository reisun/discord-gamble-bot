import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

const app = createApp();
const ADMIN_TOKEN = 'test-admin-token';

describe('GET /api/auth/verify', () => {
  it('管理者トークンが正しい場合 isAdmin: true を返す', async () => {
    const res = await request(app)
      .get('/api/auth/verify')
      .query({ token: ADMIN_TOKEN });

    expect(res.status).toBe(200);
    expect(res.body.data.isAdmin).toBe(true);
  });

  it('トークンが不正な場合 isAdmin: false を返す', async () => {
    const res = await request(app)
      .get('/api/auth/verify')
      .query({ token: 'wrong-token' });

    expect(res.status).toBe(200);
    expect(res.body.data.isAdmin).toBe(false);
  });

  it('トークンなしの場合 isAdmin: false を返す', async () => {
    const res = await request(app).get('/api/auth/verify');

    expect(res.status).toBe(200);
    expect(res.body.data.isAdmin).toBe(false);
  });

  it('Authorization: Bearer ヘッダーでも認証できる', async () => {
    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isAdmin).toBe(true);
  });
});

describe('管理者権限が必要なエンドポイント（401/403）', () => {
  it('トークンなしで POST /api/events すると 401 を返す', async () => {
    const res = await request(app)
      .post('/api/events')
      .send({ name: 'テスト', initialPoints: 1000 });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('不正トークンで POST /api/events すると 403 を返す', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', 'Bearer wrong-token')
      .send({ name: 'テスト', initialPoints: 1000 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
