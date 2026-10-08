import { afterEach, expect, it, vi } from 'vitest';
import { getApiBaseUrl, loadConfig } from '../config';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('loads the Pages base path without caching and appends the API path', async () => {
  vi.stubEnv('DEV', false);
  vi.stubEnv('BASE_URL', '/discord-gamble-bot/');
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ apiBaseUrl: 'https://example.trycloudflare.com/' }),
  });
  vi.stubGlobal('fetch', fetch);
  await loadConfig();
  expect(fetch).toHaveBeenCalledWith('/discord-gamble-bot/config.json', { cache: 'no-store' });
  expect(getApiBaseUrl()).toBe('https://example.trycloudflare.com/api');
});

it.each(['http://example.test', 'https://user:password@example.test', 'https://example.test/?q=x'])(
  'rejects invalid production connection settings: %s',
  async (apiBaseUrl) => {
    vi.stubEnv('DEV', false);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ apiBaseUrl }) })
    );
    await expect(loadConfig()).rejects.toThrow();
  }
);

it('rejects missing production config', async () => {
  vi.stubEnv('DEV', false);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  await expect(loadConfig()).rejects.toThrow('API接続設定を読み込めません');
});
