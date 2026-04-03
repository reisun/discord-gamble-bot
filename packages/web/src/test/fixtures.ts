import type { Event, Game, BetsData, User, UserEventResult } from '../api/types';

export const mockEvent: Event = {
  id: 1,
  guildId: 'test-guild-001',
  name: '春季大会',
  isActive: true,
  isPublished: true,
  initialPoints: 10000,
  resultsPublic: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

export const mockEventInactive: Event = {
  ...mockEvent,
  id: 2,
  name: '夏季カップ',
  isActive: false,
  isPublished: false,
};

export const mockGameSingle: Game = {
  id: 1,
  eventId: 1,
  title: '第1試合',
  description: null,
  deadline: '2099-01-01T12:00:00Z',
  isPublished: true,
  status: 'open',
  betType: 'single',
  requiredSelections: null,
  resultSymbols: null,
  betOptions: [
    { id: 1, symbol: 'A', label: 'チームA', order: 1 },
    { id: 2, symbol: 'B', label: 'チームB', order: 2 },
  ],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

export const mockGameMultiOrdered: Game = {
  ...mockGameSingle,
  id: 2,
  title: '第2試合',
  betType: 'multi_ordered',
  requiredSelections: 3,
  status: 'closed',
  isPublished: true,
  betOptions: [
    { id: 1, symbol: 'A', label: 'チームA', order: 1 },
    { id: 2, symbol: 'B', label: 'チームB', order: 2 },
    { id: 3, symbol: 'C', label: 'チームC', order: 3 },
    { id: 4, symbol: 'D', label: 'チームD', order: 4 },
  ],
};

export const mockGameFinished: Game = {
  ...mockGameSingle,
  id: 3,
  title: '第3試合',
  status: 'finished',
  resultSymbols: 'A',
};

export const mockGameUnpublished: Game = {
  ...mockGameSingle,
  id: 4,
  title: '第4試合',
  isPublished: false,
};

export const mockBetsData: BetsData = {
  betType: 'single',
  requiredSelections: null,
  totalPoints: 1000,
  combinations: [
    {
      selectedSymbols: 'A',
      selectedLabels: ['チームA'],
      totalPoints: 600,
      betCount: 3,
      odds: 1.67,
    },
    {
      selectedSymbols: 'B',
      selectedLabels: ['チームB'],
      totalPoints: 400,
      betCount: 2,
      odds: 2.5,
    },
  ],
  bets: [
    {
      userId: 1,
      userName: 'User A',
      selectedSymbols: 'A',
      selectedLabels: ['チームA'],
      amount: 100,
      isDebt: false,
      result: null,
      pointChange: null,
    },
  ],
};

export const mockBetsFinished: BetsData = {
  ...mockBetsData,
  combinations: [
    { ...mockBetsData.combinations[0], },
    { ...mockBetsData.combinations[1], },
  ],
  bets: [
    { ...mockBetsData.bets[0], result: 'win', pointChange: 167 },
  ],
};

export const mockUser: User = {
  id: 1,
  discordId: '123456789',
  discordName: 'User A',
  points: 10500,
  debt: 0,
};

export const mockUserEventResult: UserEventResult = {
  userId: 1,
  eventId: 1,
  totalPointChange: 500,
  totalDebt: 0,
  totalAssets: 10500,
  totalAssetsChange: 500,
  wins: 3,
  losses: 1,
  games: [
    {
      gameId: 1,
      gameTitle: '第1試合',
      betType: 'single',
      requiredSelections: null,
      selectedSymbols: 'A',
      selectedLabels: ['チームA'],
      amount: 50,
      isDebt: false,
      debtChange: 0,
      pointChange: 70,
      result: 'win',
    },
  ],
};
