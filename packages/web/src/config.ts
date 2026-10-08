let apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

export async function loadConfig(): Promise<void> {
  if (import.meta.env.DEV) return;
  const response = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error('API接続設定を読み込めません。管理者に連絡してください。');
  const config = await response.json();
  if (typeof config.apiBaseUrl !== 'string') throw new Error('API接続設定が不正です。');
  const url = new URL(config.apiBaseUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('API接続設定が不正です。');
  }
  apiBaseUrl = url.href.replace(/\/$/, '') + '/api';
}
