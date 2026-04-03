// イベント
export interface Event {
  id: number;
  name: string;
  isActive: boolean;
  initialPoints: number;
  resultsPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

// 賭け方式
export type BetType = 'single' | 'multi_unordered' | 'multi_ordered' | 'multi_ordered_dup';

// ゲームステータス
export type GameStatus = 'open' | 'closed' | 'finished';

// 賭け項目
export interface BetOption {
  id: number;
  symbol: string;
  label: string;
  order: number;
}

// ゲーム
export interface Game {
  id: number;
  eventId: number;
  title: string;
  description: string | null;
  deadline: string;
  isPublished: boolean;
  status: GameStatus;
  betType: BetType;
  requiredSelections: number | null;
  resultSymbols: string | null;
  betOptions: BetOption[];
  createdAt: string;
  updatedAt: string;
}

// 賭け組み合わせ
export interface BetCombination {
  selectedSymbols: string;
  selectedLabels: string[];
  totalPoints: number;
  betCount: number;
  odds: number;
}

// 個別の賭け
export interface BetEntry {
  userId: number;
  userName: string;
  selectedSymbols: string;
  selectedLabels: string[];
  amount: number;
  isDebt: boolean;
  result: 'win' | 'lose' | null;
  pointChange: number | null;
}

// 賭け状況レスポンス
export interface BetsData {
  betType: BetType;
  requiredSelections: number | null;
  totalPoints: number;
  combinations: BetCombination[];
  bets: BetEntry[];
}

// ユーザー（一般）
export interface User {
  id: number;
  discordId: string;
  discordName: string;
  points: number;
  debt?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ユーザー別ゲーム結果
export interface UserGameResult {
  gameId: number;
  gameTitle: string;
  betType: BetType;
  requiredSelections: number | null;
  selectedSymbols: string;
  selectedLabels: string[];
  amount: number;
  isDebt: boolean;
  debtChange: number;
  pointChange: number;
  result: 'win' | 'lose' | null;
}

// ユーザー別イベント結果
export interface UserEventResult {
  userId: number;
  eventId: number;
  totalPointChange: number;
  totalDebt: number;
  totalAssets: number;
  totalAssetsChange: number;
  wins: number;
  losses: number;
  games: UserGameResult[];
}

// APIエラー
export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
