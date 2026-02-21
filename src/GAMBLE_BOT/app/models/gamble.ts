export type GambleSyncMode = "full" | "incremental";

export type GambleUserBalance = {
  userId: string,
  name: string,
  initialPoint: number,
  currentPoint: number,
}

export type GambleBet = {
  sessionId: string,
  gameId: string,
  userId: string,
  ticket: string,
  point: number,
  amount: number,
  createdAt: Date,
}

export type GambleGameStatus = "open" | "closed" | "resolved";
export type GambleOddsMode = "fixed" | "pari_mutuel";

export type GambleGame = {
  sessionId: string,
  gameId: string,
  status: GambleGameStatus,
  bets: GambleBet[],
  resolvedAt?: Date | null,
  winningTicket?: string,
  oddsMode: GambleOddsMode,
  resolvedTicket?: string,
  createdAt: Date,
  updatedAt: Date,
}

export type LedgerType = "stake_settlement" | "payout";

export type UserBalance = {
  userId: string,
  balance: number,
  updatedAt: Date,
}

export type GambleLedger = {
  sessionId: string,
  gameId: string,
  userId: string,
  delta: number,
  reason: string,
  type: LedgerType,
  amount: number,
  balanceAfter: number,
  createdAt: Date,
  note: string,
}

export type GambleSessionVersion = 1;
export const GambleSessionVersion = 1;

export type GambleSession = {
  sessionId: string,
  guildId: string,
  channelId: string,
  gmPasswordHash: string,
  syncSheet: {
    spreadsheetId: string,
    sheetName: string,
  },
  initialPoint: number,
  spreadsheetId: string,
  sheetName: string,
  credentialRef: string,
  users_balance: GambleUserBalance[],
  bets: GambleBet[],
  ledger: GambleLedger[],
  last_sync_datatime: Date,
  createdAt: Date,
  updatedAt: Date,
  version: GambleSessionVersion,
}
