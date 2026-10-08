import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it('uses the internal listener and ignores the legacy public API setting', async () => {
  vi.stubEnv('BOT_API_BASE_URL', undefined);
  vi.stubEnv('API_BASE_URL', 'http://server:3000');
  const { config } = await import('../config.js');
  expect(config.apiBaseUrl).toBe('http://server:3002');
});

it('allows an explicitly configured Bot internal API endpoint', async () => {
  vi.stubEnv('BOT_API_BASE_URL', 'http://internal-server:3002');
  const { config } = await import('../config.js');
  expect(config.apiBaseUrl).toBe('http://internal-server:3002');
});
