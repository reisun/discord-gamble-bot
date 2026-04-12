import axios, { AxiosError } from 'axios';
import { config } from '../config';

export const api = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 10_000,
});

const TOKEN_REFRESH_MS = 11 * 60 * 60 * 1000; // 11時間（有効期限12時間の前に更新）

/**
 * 内部エンドポイント経由でBot用トークンを取得し、
 * axios のデフォルト Authorization ヘッダーにセットする。
 */
export async function initBotToken(): Promise<void> {
  const internalBase = `${config.apiBaseUrl.replace(/\/$/, '')}/internal`;
  const res = await axios.post<{ data: { token: string } }>(
    `${internalBase}/api/auth/token`,
    { guildId: '*', role: 'editor' },
    { timeout: 10_000 },
  );
  const token = res.data.data.token;
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  console.log('[Bot] API token acquired');
}

/** トークンを定期的に更新する */
export function startTokenRefresh(): void {
  setInterval(async () => {
    try {
      await initBotToken();
    } catch (err) {
      console.error('[Bot] Failed to refresh API token:', err);
    }
  }, TOKEN_REFRESH_MS);
}

/** API エラーレスポンスの共通型 */
export type ApiErrorBody = {
  error: { code: string; message: string };
};

/**
 * AxiosError から人間向けメッセージを取り出す。
 * API が返す `error.message` があればそれを、なければ汎用メッセージを返す。
 */
export function extractApiMessage(err: unknown): string {
  if (err instanceof AxiosError && err.response?.data) {
    const body = err.response.data as ApiErrorBody;
    if (body.error?.message) return body.error.message;
  }
  return '通信エラーが発生しました。しばらく待ってから再試行してください。';
}

// ---------- 型定義 ----------

export type BetOption = {
  id: number;
  symbol: string;
  label: string;
  order: number;
};

export type Game = {
  id: number;
  eventId: number;
  title: string;
  description: string | null;
  deadline: string;
  closeAfterMinutes: number;
  isPublished: boolean;
  status: 'open' | 'closed' | 'finished';
  betType: 'single' | 'multi_unordered' | 'multi_ordered' | 'multi_ordered_dup';
  requiredSelections: number | null;
  resultSymbols: string | null;
  betOptions: BetOption[];
};

export type Event = {
  id: number;
  guildId: string;
  name: string;
  isActive: boolean;
  initialPoints: number;
  resultsPublic: boolean;
};

export type BetRecord = {
  userId: number;
  userName: string;
  selectedSymbols: string;
  selectedLabels: string[];
  amount: number;
  isDebt: boolean;
  result: 'win' | 'lose' | null;
  pointChange?: number;
};

export type BetListResponse = {
  betType: string;
  requiredSelections: number | null;
  totalPoints?: number;
  combinations: {
    selectedSymbols: string;
    selectedLabels: string[];
    totalPoints?: number;
    betCount?: number;
    odds: number | null;
  }[];
  bets: BetRecord[];
};

export type UserInfo = {
  id: number;
  discordId: string;
  discordName: string;
  points: number;
};

export type EventBetEntry = {
  gameId: number;
  gameTitle: string;
  gameStatus: 'open' | 'closed' | 'finished';
  betType: string;
  requiredSelections: number | null;
  deadline: string;
  selectedSymbols: string;
  selectedLabels: string[];
  amount: number;
  isDebt: boolean;
  odds: number | null;
  estimatedPayout: number | null;
  result: 'win' | 'lose' | null;
  pointChange: number | null;
};

export type EventBetsResponse = {
  eventId: number;
  eventName: string;
  currentPoints: number;
  bets: EventBetEntry[];
};

// ---------- API 呼び出し関数 ----------

export async function getGame(gameId: number): Promise<Game> {
  const res = await api.get<{ data: Game }>(`/api/games/${gameId}`);
  return res.data.data;
}

export async function getEvents(guildId: string): Promise<Event[]> {
  const res = await api.get<{ data: Event[] }>('/api/events', { params: { guildId } });
  return res.data.data;
}

export async function getEventGames(eventId: number): Promise<Game[]> {
  const res = await api.get<{ data: Game[] }>(`/api/events/${eventId}/games`);
  return res.data.data;
}

/** 非公開ゲームを含む全ゲームを取得する */
export async function getEventGamesAdmin(eventId: number): Promise<Game[]> {
  const res = await api.get<{ data: Game[] }>(`/api/events/${eventId}/games?includeUnpublished=true`);
  return res.data.data;
}

/** ゲームの公開フラグを ON にする */
export async function publishGame(gameId: number): Promise<void> {
  await api.patch(`/api/games/${gameId}/publish`, { isPublished: true });
}

export async function getBetList(gameId: number): Promise<BetListResponse> {
  const res = await api.get<{ data: BetListResponse }>(`/api/games/${gameId}/bets`);
  return res.data.data;
}

export async function placeBet(
  gameId: number,
  discordId: string,
  discordName: string,
  selectedSymbols: string,
  amount: number,
  allowDebt: boolean,
  avatarUrl?: string,
): Promise<{
  id: number;
  gameId: number;
  userId: number;
  selectedSymbols: string;
  selectedLabels: string[];
  amount: number;
  isDebt: boolean;
  debtAmount: number;
  isUpdated: boolean;
}> {
  const res = await api.put(`/api/games/${gameId}/bets`, {
    discordId,
    discordName,
    avatarUrl,
    selectedSymbols,
    amount,
    allowDebt,
  });
  return res.data.data;
}

export async function getUserByDiscordId(
  discordId: string,
  eventId?: number,
): Promise<UserInfo> {
  const params = eventId !== undefined ? { eventId } : {};
  const res = await api.get<{ data: UserInfo }>(`/api/users/discord/${discordId}`, { params });
  return res.data.data;
}

export async function getEventBets(
  userId: number,
  eventId: number,
): Promise<EventBetsResponse> {
  const res = await api.get<{ data: EventBetsResponse }>(
    `/api/users/${userId}/event-bets/${eventId}`,
  );
  return res.data.data;
}

export async function getGameByNo(
  guildId: string,
  gameNo: number,
): Promise<Game> {
  const events = await getEvents(guildId);
  const activeEvent = events.find((e) => e.isActive);
  if (!activeEvent) throw new Error('開催中のイベントが見つかりません。');
  const allGames = await getEventGames(activeEvent.id);
  const game = allGames[gameNo - 1];
  if (!game) throw new Error(`ゲーム番号 ${gameNo} が見つかりません。`);
  return game;
}

export async function registerGuild(guildId: string, guildName: string, guildIconHash?: string | null): Promise<void> {
  await api.put(`/api/guilds/${guildId}`, { guildName, guildIconHash: guildIconHash ?? null });
}
