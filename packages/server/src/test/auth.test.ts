import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { pool } from '../db';

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

  it('トークンが不正な場合 401 TOKEN_EXPIRED を返す', async () => {
    const res = await request(app)
      .get('/api/auth/verify')
      .query({ token: 'wrong-token' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
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

describe('POST /api/auth/token', () => {
  it('管理者トークンでトークンを生成できる', async () => {
    const res = await request(app)
      .post('/api/auth/token')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ guildId: 'guild-001', role: 'editor' });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.token.length).toBeGreaterThan(0);
  });

  it('viewer ロールのトークンも生成できる', async () => {
    const res = await request(app)
      .post('/api/auth/token')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ guildId: 'guild-001', role: 'viewer' });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.token).toBe('string');
  });

  it('トークンなしで POST /api/auth/token すると 401 を返す', async () => {
    const res = await request(app)
      .post('/api/auth/token')
      .send({ guildId: 'guild-001', role: 'editor' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('不正トークンで POST /api/auth/token すると 403 を返す', async () => {
    const res = await request(app)
      .post('/api/auth/token')
      .set('Authorization', 'Bearer wrong-token')
      .send({ guildId: 'guild-001', role: 'editor' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('role が不正な場合 400 を返す', async () => {
    const res = await request(app)
      .post('/api/auth/token')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ guildId: 'guild-001', role: 'superadmin' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('生成したトークンで GET /api/auth/verify が認証される', async () => {
    const tokenRes = await request(app)
      .post('/api/auth/token')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ guildId: 'guild-001', role: 'editor' });

    const { token } = tokenRes.body.data;

    const verifyRes = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${token}`);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.isAdmin).toBe(true);
  });

  it('期限切れトークンで GET /api/auth/verify が 401 TOKEN_EXPIRED を返す', async () => {
    const tokenRes = await request(app)
      .post('/api/auth/token')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ guildId: 'guild-001', role: 'editor' });

    const { token } = tokenRes.body.data;

    await pool.query("UPDATE access_tokens SET expires_at = NOW() - interval '1 hour'");

    const verifyRes = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${token}`);

    expect(verifyRes.status).toBe(401);
    expect(verifyRes.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('viewer トークンは isAdmin: false を返す', async () => {
    const tokenRes = await request(app)
      .post('/api/auth/token')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ guildId: 'guild-001', role: 'viewer' });

    const { token } = tokenRes.body.data;

    const verifyRes = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${token}`);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.isAdmin).toBe(false);
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
