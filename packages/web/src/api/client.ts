import type {
  Event,
  Game,
  BetsData,
  Guild,
  User,
  UserEventResult,
} from './types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';
const SESSION_STORAGE_KEY = 'discord-gamble-session';

// TOKEN_EXPIRED エラーを区別するためのカスタムイベント
export const TOKEN_EXPIRED_EVENT = 'discord-gamble-token-expired';

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  // トークンが渡されなければ localStorage から取得
  const resolvedToken = token ?? localStorage.getItem(SESSION_STORAGE_KEY) ?? undefined;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (resolvedToken) {
    headers['Authorization'] = `Bearer ${resolvedToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    let errCode = '';
    try {
      const body = await res.json();
      errMsg = body?.error?.message ?? errMsg;
      errCode = body?.error?.code ?? '';
    } catch {
      // ignore parse error
    }
    if (res.status === 401 && errCode === 'TOKEN_EXPIRED') {
      window.dispatchEvent(new CustomEvent(TOKEN_EXPIRED_EVENT));
    }
    throw new Error(errMsg);
  }

  if (res.status === 204) return undefined as unknown as T;
  const json = await res.json();
  return json.data as T;
}

// 認証
export function verifySession(token: string): Promise<{ isAdmin: boolean; guildId: string; discordUsername: string }> {
  return request('/auth/session', {}, token);
}

/** @deprecated Use verifySession instead */
export function verifyToken(token: string): Promise<{ isAdmin: boolean }> {
  return request('/auth/verify', {}, token);
}

// ギルド
export function getGuild(guildId: string): Promise<Guild> {
  return request(`/guilds/${guildId}`);
}

// イベント
export function getEvents(token?: string, guildId?: string): Promise<Event[]> {
  const query = guildId ? `?guildId=${encodeURIComponent(guildId)}` : '';
  return request(`/events${query}`, {}, token);
}

export function getEvent(id: number, token?: string): Promise<Event> {
  return request(`/events/${id}`, {}, token);
}

export function createEvent(
  body: { name: string; initialPoints?: number; resultsPublic?: boolean; guildId: string },
  token: string,
): Promise<Event> {
  return request('/events', { method: 'POST', body: JSON.stringify(body) }, token);
}

export function updateEvent(
  id: number,
  body: { name: string; initialPoints?: number; resultsPublic?: boolean },
  token: string,
): Promise<Event> {
  return request(`/events/${id}`, { method: 'PUT', body: JSON.stringify(body) }, token);
}

export function deleteEvent(id: number, token: string): Promise<void> {
  return request(`/events/${id}`, { method: 'DELETE' }, token);
}

export function activateEvent(id: number, token: string): Promise<Event> {
  return request(`/events/${id}/activate`, { method: 'PATCH' }, token);
}

export function publishEvent(id: number, isPublished: boolean, token: string): Promise<Event> {
  return request(
    `/events/${id}/publish`,
    { method: 'PATCH', body: JSON.stringify({ isPublished }) },
    token,
  );
}

export function updateEventResultsPublic(
  id: number,
  resultsPublic: boolean,
  token: string,
): Promise<Event> {
  return request(
    `/events/${id}`,
    { method: 'PUT', body: JSON.stringify({ resultsPublic }) },
    token,
  );
}

// ゲーム
export function getGames(
  eventId: number,
  token?: string,
): Promise<Game[]> {
  const query = token ? '?includeUnpublished=true' : '';
  return request(`/events/${eventId}/games${query}`, {}, token);
}

export function getGame(id: number, token?: string): Promise<Game> {
  return request(`/games/${id}`, {}, token);
}

export function createGame(
  eventId: number,
  body: {
    title: string;
    description?: string;
    closeAfterMinutes?: number;
    betType?: string;
    requiredSelections?: number | null;
    betOptions: { symbol: string; label: string }[];
  },
  token: string,
): Promise<Game> {
  return request(
    `/events/${eventId}/games`,
    { method: 'POST', body: JSON.stringify(body) },
    token,
  );
}

export function updateGame(
  id: number,
  body: {
    title: string;
    description?: string;
    closeAfterMinutes?: number;
    betType?: string;
    requiredSelections?: number | null;
    betOptions?: { symbol: string; label: string }[];
  },
  token: string,
): Promise<Game> {
  return request(`/games/${id}`, { method: 'PUT', body: JSON.stringify(body) }, token);
}

export function deleteGame(id: number, token: string): Promise<void> {
  return request(`/games/${id}`, { method: 'DELETE' }, token);
}

export function publishGame(
  id: number,
  isPublished: boolean,
  token: string,
): Promise<Game> {
  return request(
    `/games/${id}/publish`,
    { method: 'PATCH', body: JSON.stringify({ isPublished }) },
    token,
  );
}

export function closeGameNow(id: number, token: string): Promise<Game> {
  return request(`/games/${id}/close-now`, { method: 'PATCH' }, token);
}

export function setGameResult(
  id: number,
  resultSymbols: string,
  token: string,
): Promise<Game> {
  return request(
    `/games/${id}/result`,
    { method: 'PATCH', body: JSON.stringify({ resultSymbols }) },
    token,
  );
}

// 賭け
export function getBets(gameId: number, token?: string): Promise<BetsData> {
  return request(`/games/${gameId}/bets`, {}, token);
}

// ユーザー
export function getUsers(eventId: number, token?: string): Promise<User[]> {
  return request(`/users?eventId=${eventId}`, {}, token);
}

export function getUserEventResults(
  userId: number,
  eventId: number,
  token?: string,
): Promise<UserEventResult> {
  return request(`/users/${userId}/event-results/${eventId}`, {}, token);
}
