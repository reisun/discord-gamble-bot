import type {
  Event,
  Game,
  BetsData,
  Guild,
  User,
  UserEventResult,
} from './types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers, credentials: 'include' });

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      errMsg = body?.error?.message ?? errMsg;
    } catch {
      // ignore parse error
    }
    throw new Error(errMsg);
  }

  if (res.status === 204) return undefined as unknown as T;
  const json = await res.json();
  return json.data as T;
}

// 認証
export function getSession(): Promise<{ isEditor: boolean; guildId: string }> {
  return request('/auth/session');
}

// ギルド
export function getGuild(guildId: string): Promise<Guild> {
  return request(`/guilds/${guildId}`);
}

// イベント
export function getEvents(guildId?: string): Promise<Event[]> {
  const query = guildId ? `?guildId=${encodeURIComponent(guildId)}` : '';
  return request(`/events${query}`);
}

export function getEvent(id: number): Promise<Event> {
  return request(`/events/${id}`);
}

export function createEvent(
  body: { name: string; initialPoints?: number; resultsPublic?: boolean; guildId: string },
): Promise<Event> {
  return request('/events', { method: 'POST', body: JSON.stringify(body) });
}

export function updateEvent(
  id: number,
  body: { name: string; initialPoints?: number; resultsPublic?: boolean },
): Promise<Event> {
  return request(`/events/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function deleteEvent(id: number): Promise<void> {
  return request(`/events/${id}`, { method: 'DELETE' });
}

export function activateEvent(id: number): Promise<Event> {
  return request(`/events/${id}/activate`, { method: 'PATCH' });
}

export function publishEvent(id: number, isPublished: boolean): Promise<Event> {
  return request(
    `/events/${id}/publish`,
    { method: 'PATCH', body: JSON.stringify({ isPublished }) },
  );
}

export function updateEventResultsPublic(
  id: number,
  resultsPublic: boolean,
): Promise<Event> {
  return request(
    `/events/${id}`,
    { method: 'PUT', body: JSON.stringify({ resultsPublic }) },
  );
}

// ゲーム
export function getGames(eventId: number): Promise<Game[]> {
  return request(`/events/${eventId}/games`);
}

export function getGame(id: number): Promise<Game> {
  return request(`/games/${id}`);
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
): Promise<Game> {
  return request(
    `/events/${eventId}/games`,
    { method: 'POST', body: JSON.stringify(body) },
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
): Promise<Game> {
  return request(`/games/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function deleteGame(id: number): Promise<void> {
  return request(`/games/${id}`, { method: 'DELETE' });
}

export function publishGame(
  id: number,
  isPublished: boolean,
): Promise<Game> {
  return request(
    `/games/${id}/publish`,
    { method: 'PATCH', body: JSON.stringify({ isPublished }) },
  );
}

export function closeGameNow(id: number): Promise<Game> {
  return request(`/games/${id}/close-now`, { method: 'PATCH' });
}

export function setGameResult(
  id: number,
  resultSymbols: string,
): Promise<Game> {
  return request(
    `/games/${id}/result`,
    { method: 'PATCH', body: JSON.stringify({ resultSymbols }) },
  );
}

// 賭け
export function getBets(gameId: number): Promise<BetsData> {
  return request(`/games/${gameId}/bets`);
}

// ユーザー
export function getUsers(eventId: number): Promise<User[]> {
  return request(`/users?eventId=${eventId}`);
}

export function getUserEventResults(
  userId: number,
  eventId: number,
): Promise<UserEventResult> {
  return request(`/users/${userId}/event-results/${eventId}`);
}
