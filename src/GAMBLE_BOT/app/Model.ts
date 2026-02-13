export type User = {
  id: string, name: string
}

export type SplaJinroDataVersion = 2;
export const SplaJinroDataVersion = 2;
export type SplaJinroData = {
  channel_id: string,
  add_member_list: User[],
  ignore_member_list: User[],
  prev_suggest_role_command_string: string,
  prev_send_role_command_string: string,
  eject_member_list: User[],
  send_role_option: string,
  last_update_datatime: Date,
  version: SplaJinroDataVersion,
}

// メンバー情報
export type MemberRoleInfo = {
  id: string,
  name: string,
  alphabet: string,
  theName: string,
  role: string,
};

// オプション情報
export type MemberRoleOptionCanKnow = {
  targetRole: string,
  action: "canknow",
  complement: string,
}
export type SendMemberRoleOption = MemberRoleOptionCanKnow /* | その他の型 */;


export type WorkData = {
  process_uuid: string,
  sorter: number,
  data: any,
}

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