import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

describe('GET /api/entrance/:guildId', () => {
  it('tokenなし・セッションなし → 401 を返す', async () => {
    const res = await request(app).get('/api/entrance/guild-123');
    expect(res.status).toBe(401);
  });

  it('無効token → 400 を返す', async () => {
    const res = await request(app)
      .get('/api/entrance/guild-123')
      .query({ token: 'invalid-token' });
    expect(res.status).toBe(400);
  });
});
