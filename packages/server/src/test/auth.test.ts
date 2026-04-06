import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

const app = createApp();
const ADMIN_TOKEN = 'test-admin-token';

describe('POST /api/auth/token', () => {
  it('トークンなしで呼ぶと 401 を返す', async () => {
    const res = await request(app)
      .post('/api/auth/token')
      .send({ guildId: 'guild-123', role: 'viewer' });

    expect(res.status).toBe(401);
  });

  it('不正トークンで呼ぶと 403 を返す', async () => {
    const res = await request(app)
      .post('/api/auth/token')
      .set('Authorization', 'Bearer wrong-token')
      .send({ guildId: 'guild-123', role: 'viewer' });

    expect(res.status).toBe(403);
  });

  it('正しいトークンでも guildId/role が不正なら 400 を返す', async () => {
    const res = await request(app)
      .post('/api/auth/token')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ guildId: 'guild-123' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/session', () => {
  it('セッションなしで呼ぶと 401 ��返す', async () => {
    const res = await request(app).get('/api/auth/session');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
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

  it('Bearer ヘッダーで正しいトークンを送ると認証される', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ name: 'テスト', initialPoints: 1000, guildId: 'guild-123' });

    // 認証は通る (DB接続がないためエラーになる場合もあるが、401/403にはなら��い)
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});
