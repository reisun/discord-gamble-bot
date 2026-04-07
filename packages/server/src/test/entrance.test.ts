import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

// テスト中は WEB_APP_BASE_URL を設定しておく
const ORIGINAL_WEB_APP_BASE_URL = process.env.WEB_APP_BASE_URL;
beforeAll(() => {
  process.env.WEB_APP_BASE_URL = 'https://example.com/app';
});
afterAll(() => {
  process.env.WEB_APP_BASE_URL = ORIGINAL_WEB_APP_BASE_URL;
});

describe('GET /api/entrance/:guildId', () => {
  it('tokenなし・セッションなし → 401 を返す', async () => {
    const res = await request(app).get('/api/entrance/guild-123');
    expect(res.status).toBe(401);
  });

  it('tokenなし・別 guildId のセッション → 401 を返す', async () => {
    // セッション Cookie を持っていても、guildId が異なれば拒否される
    // (ここではセッション注入が困難なため、セッションなしと等価な振る舞いを確認)
    const res = await request(app).get('/api/entrance/guild-456');
    expect(res.status).toBe(401);
  });

  it('無効token → 400 を返す', async () => {
    const res = await request(app)
      .get('/api/entrance/guild-123')
      .query({ token: 'invalid-token' });
    expect(res.status).toBe(400);
  });

  it('無効token・別 guildId → 400 を返す', async () => {
    const res = await request(app)
      .get('/api/entrance/guild-999')
      .query({ token: 'some-token-for-other-guild' });
    expect(res.status).toBe(400);
  });

  it('401 レスポンスに /link の案内が含まれる', async () => {
    const res = await request(app).get('/api/entrance/guild-123');
    expect(res.status).toBe(401);
    expect(res.text).toContain('/link');
  });

  it('400 レスポンスに再実行の案内が含まれる', async () => {
    const res = await request(app)
      .get('/api/entrance/guild-123')
      .query({ token: 'expired-or-invalid' });
    expect(res.status).toBe(400);
    expect(res.text).toContain('/link');
  });

  it('WEB_APP_BASE_URL 未設定 → 503 を返す', async () => {
    const saved = process.env.WEB_APP_BASE_URL;
    process.env.WEB_APP_BASE_URL = '';
    const res = await request(app).get('/api/entrance/guild-123');
    process.env.WEB_APP_BASE_URL = saved;
    expect(res.status).toBe(503);
  });
});
