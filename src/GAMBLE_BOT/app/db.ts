import { MongoClient, Collection, MatchKeysAndValues } from 'mongodb'
import { Result, ResultOK, ResultUtil } from './Result';
import { coreMessages } from './constants/core';
import { 
  GambleGame,
  GambleSession, 
  GambleGameStatus,
  GambleBet,
  GambleLedger,
  GambleOddsMode,
  GambleSessionVersion, 
  SplaJinroData, 
  SplaJinroDataVersion, 
  UserBalance,
  WorkData 
} from "./Model";
import config from './config';
import { buildPayoutSummary, PayoutSummary } from './gamble/Payout';


export class DBUtils {
  static createNewSplaJinroDataObj = (channelId: string): SplaJinroData => {
    return {
      channel_id: channelId,
      add_member_list: [],
      ignore_member_list: [],
      prev_suggest_role_command_string: "",
      prev_send_role_command_string: "",
      eject_member_list: [],
      send_role_option: "狂人>知れる>人狼",
      last_update_datatime: new Date(),
      version: SplaJinroDataVersion,
    };
  }

  static createNewGambleSessionObj = (channelId: string): GambleSession => {
    return {
      sessionId: "",
      guildId: "",
      channelId: channelId,
      gmPasswordHash: "",
      syncSheet: {
        spreadsheetId: "",
        sheetName: "",
      },
      initialPoint: 10000,
      spreadsheetId: "",
      sheetName: "",
      credentialRef: "",
      users_balance: [],
      bets: [],
      ledger: [],
      last_sync_datatime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: GambleSessionVersion,
    };
  }
}

export type ResolveGameResult = {
  game: GambleGame,
  summary: PayoutSummary,
}

export class DBAccesser {
  private constructor(
    private client: MongoClient,
    public SplaJinroData: Collection<SplaJinroData>,
    public WorkData: Collection<WorkData>,
    public GambleSession: Collection<GambleSession>,
    public GambleGame: Collection<GambleGame>,
    public GambleLedger: Collection<GambleLedger>,
    public UserBalance: Collection<UserBalance>,
    public GambleBet: Collection<GambleBet>,
  ) {
  }

  static async connect(): Promise<DBAccesser> {
    const client = await MongoClient.connect(config.mongodbUri);
    const db = client.db('appData');
    const splaJinroData = db.collection<SplaJinroData>('SplaJinroData');
    const workData = db.collection<WorkData>("WorkData");
    const gambleSession = db.collection<GambleSession>('GambleSession');
    const gambleGame = db.collection<GambleGame>('GambleGame');
    const gambleLedger = db.collection<GambleLedger>('GambleLedger');
    const userBalance = db.collection<UserBalance>('UserBalance');
    const gambleBet = db.collection<GambleBet>('GambleBet');

    await Promise.all([
      gambleGame.createIndex({ sessionId: 1, gameId: 1 }, { unique: true }),
      gambleBet.createIndex({ sessionId: 1, gameId: 1, userId: 1 }),
      gambleLedger.createIndex({ sessionId: 1, userId: 1, createdAt: 1 }),
      gambleSession.createIndex({ sessionId: 1 }, { unique: true }),
      gambleSession.createIndex({ guildId: 1, channelId: 1 }, { unique: true }),
    ]);

    return new DBAccesser(
      client,
      splaJinroData,
      workData,
      gambleSession,
      gambleGame,
      gambleLedger,
      userBalance,
      gambleBet,
    );
  }

  private static nowDate(): Date {
    return new Date();
  }

  async asyncCreateOrUpdateGambleSession(params: {
    sessionId: string,
    guildId: string,
    channelId: string,
    gmPasswordHash: string,
    syncSheet: GambleSession["syncSheet"],
    initialPoint: number,
  }): Promise<GambleSession> {
    const now = DBAccesser.nowDate();
    await this.GambleSession.updateOne(
      { sessionId: params.sessionId },
      {
        $set: {
          guildId: params.guildId,
          channelId: params.channelId,
          gmPasswordHash: params.gmPasswordHash,
          syncSheet: params.syncSheet,
          initialPoint: params.initialPoint,
          updatedAt: now,
        },
        $setOnInsert: {
          sessionId: params.sessionId,
          createdAt: now,
        },
      },
      { upsert: true },
    );
    const session = await this.GambleSession.findOne({ sessionId: params.sessionId });
    if (!session) {
      throw new Error("failed to create or update gamble session");
    }
    return session;
  }

  async asyncUpdateGambleSessionPassword(sessionId: string, gmPasswordHash: string): Promise<boolean> {
    const updRet = await this.GambleSession.updateOne(
      { sessionId },
      {
        $set: {
          gmPasswordHash,
          updatedAt: DBAccesser.nowDate(),
        },
      },
    );
    return updRet.acknowledged && updRet.modifiedCount > 0;
  }

  async asyncUpdateGambleSessionSyncSheet(sessionId: string, syncSheet: GambleSession["syncSheet"]): Promise<boolean> {
    const updRet = await this.GambleSession.updateOne(
      { sessionId },
      {
        $set: {
          syncSheet,
          updatedAt: DBAccesser.nowDate(),
        },
      },
    );
    return updRet.acknowledged && updRet.modifiedCount > 0;
  }

  async asyncStartGambleGame(sessionId: string, gameId: string, oddsMode: GambleOddsMode): Promise<GambleGame> {
    const now = DBAccesser.nowDate();
    await this.GambleGame.insertOne({
      sessionId,
      gameId,
      status: "open",
      bets: [],
      resolvedAt: null,
      winningTicket: undefined,
      oddsMode: oddsMode,
      resolvedTicket: undefined,
      createdAt: now,
      updatedAt: now,
    });
    const game = await this.GambleGame.findOne({ sessionId, gameId });
    if (!game) {
      throw new Error("failed to start gamble game");
    }
    return game;
  }

  async asyncCloseGambleGame(sessionId: string, gameId: string): Promise<boolean> {
    const updRet = await this.GambleGame.updateOne(
      { sessionId, gameId, status: "open" },
      {
        $set: {
          status: "closed",
          updatedAt: DBAccesser.nowDate(),
        },
      },
    );
    return updRet.acknowledged && updRet.modifiedCount > 0;
  }

  async asyncResolveGambleGame(sessionId: string, gameId: string, resolvedTicket: string): Promise<boolean> {
    const updRet = await this.GambleGame.updateOne(
      { sessionId, gameId, status: { $in: ["open", "closed"] } },
      {
        $set: {
          status: "resolved",
          resolvedTicket,
          updatedAt: DBAccesser.nowDate(),
        },
      },
    );
    return updRet.acknowledged && updRet.modifiedCount > 0;
  }

  async asyncInsertGambleBet(sessionId: string, bet: Omit<GambleBet, "sessionId" | "createdAt">): Promise<Result<GambleBet>> {
    const game = await this.GambleGame.findOne({ sessionId, gameId: bet.gameId });
    if (!game) {
      return ResultUtil.error(coreMessages.C00_NoData);
    }
    if (game.status !== "open") {
      return ResultUtil.error(coreMessages.C00_DBError);
    }

    const existingBet = await this.GambleBet.findOne({ sessionId, gameId: bet.gameId, userId: bet.userId });
    if (existingBet) {
      return ResultUtil.error(coreMessages.C00_DBError);
    }
    const doc: GambleBet = {
      sessionId,
      gameId: bet.gameId,
      userId: bet.userId,
      ticket: bet.ticket,
      point: bet.point,
      amount: bet.amount,
      createdAt: DBAccesser.nowDate(),
    };
    const insRet = await this.GambleBet.insertOne(doc);
    if (!insRet.acknowledged) {
      return ResultUtil.error(coreMessages.C00_DBError);
    }
    return ResultUtil.success(doc);
  }

  async asyncAddLedger(sessionId: string, ledger: Omit<GambleLedger, "sessionId" | "createdAt" | "balanceAfter">): Promise<Result<GambleLedger>> {
    const latest = await this.GambleLedger.find({ sessionId, userId: ledger.userId }).sort({ createdAt: -1 }).limit(1).toArray();
    const prevBalance = latest.length === 0 ? 0 : latest[0].balanceAfter;
    const nextBalance = prevBalance + ledger.delta;
    const doc: GambleLedger = {
      sessionId,
      gameId: ledger.gameId,
      userId: ledger.userId,
      delta: ledger.delta,
      reason: ledger.reason,
      type: ledger.type,
      amount: ledger.amount,
      createdAt: DBAccesser.nowDate(),
      balanceAfter: nextBalance,
      note: ledger.note,
    };
    const insRet = await this.GambleLedger.insertOne(doc);
    if (!insRet.acknowledged) {
      return ResultUtil.error(coreMessages.C00_DBError);
    }
    return ResultUtil.success(doc);
  }

  async asyncGetGambleBalance(sessionId: string, userId: string): Promise<number> {
    const latest = await this.GambleLedger.find({ sessionId, userId }).sort({ createdAt: -1 }).limit(1).toArray();
    if (latest.length === 0) {
      const session = await this.GambleSession.findOne({ sessionId });
      return session?.initialPoint ?? 0;
    }
    return latest[0].balanceAfter;
  }

  async asyncGetGambleLedgerHistory(sessionId: string, userId: string, limit = 50): Promise<GambleLedger[]> {
    return await this.GambleLedger.find({ sessionId, userId }).sort({ createdAt: -1 }).limit(limit).toArray();
  }

  async asyncGetGambleGame(sessionId: string, gameId: string): Promise<GambleGame | null> {
    return await this.GambleGame.findOne({ sessionId, gameId });
  }

  async asyncUpdateGambleGameStatus(sessionId: string, gameId: string, status: GambleGameStatus): Promise<boolean> {
    const updRet = await this.GambleGame.updateOne(
      { sessionId, gameId },
      {
        $set: {
          status,
          updatedAt: DBAccesser.nowDate(),
        },
      },
    );
    return updRet.acknowledged && updRet.modifiedCount > 0;
  }

  async asyncResolveGame(sessionId: string, gameId: string, winningTicket: string): Promise<ResolveGameResult> {
    const now = new Date();
    const mongoSession = this.client.startSession();
    let result: ResolveGameResult | null = null;

    try {
      await mongoSession.withTransaction(async () => {
        const game = await this.GambleGame.findOne({ sessionId, gameId }, { session: mongoSession });
        if (!game) {
          throw new Error("対象ゲームが見つかりません。");
        }
        if (game.resolvedAt != null || game.status === "resolved") {
          throw new Error("このゲームはすでに確定済みです。");
        }

        const summary = buildPayoutSummary(sessionId, gameId, game.bets, winningTicket);
        const ledgers: GambleLedger[] = summary.ledgerDrafts.map((draft) => ({
          ...draft,
          createdAt: now,
        }));

        const updateResult = await this.GambleGame.updateOne(
          {
            sessionId,
            gameId,
            resolvedAt: null,
          },
          {
            $set: {
              status: "resolved",
              resolvedAt: now,
              winningTicket,
              updatedAt: now,
            },
          },
          { session: mongoSession },
        );

        if (!updateResult.acknowledged || updateResult.modifiedCount !== 1) {
          throw new Error("このゲームはすでに確定済みです。");
        }

        if (ledgers.length > 0) {
          await this.GambleLedger.insertMany(ledgers, { session: mongoSession });
        }

        const deltaByUserId = new Map<string, number>();
        for (const ledger of ledgers) {
          deltaByUserId.set(ledger.userId, (deltaByUserId.get(ledger.userId) ?? 0) + ledger.amount);
        }

        for (const [userId, delta] of deltaByUserId.entries()) {
          await this.UserBalance.updateOne(
            { userId },
            {
              $inc: { balance: delta },
              $set: { updatedAt: now },
              $setOnInsert: { userId },
            },
            { upsert: true, session: mongoSession },
          );
        }

        result = {
          game: {
            ...game,
            status: "resolved",
            resolvedAt: now,
            winningTicket,
            updatedAt: now,
          },
          summary,
        };
      });
    }
    finally {
      await mongoSession.endSession();
    }

    if (result == null) {
      throw new Error("ゲームの確定処理に失敗しました。");
    }

    return result;
  }

  /**
  * 強制的にデータを取得する
  * （強制的とは？⇒もしデータが無ければ、新しいデータをDBに追加して取得します）
  * @error データのバージョンがソースと異なる場合。データはクリアされる
  * @param channel_id 
  * @returns 
  */
  async asyncSelectSplaJinroDataForce(channelId: string): Promise<Result<SplaJinroData>> {
    // 新規データを登録する関数
    const asyncInsertNewData = async (): Promise<Result<SplaJinroData>> => {
      const newData = DBUtils.createNewSplaJinroDataObj(channelId);
      const insRet = (await this.SplaJinroData.insertOne(newData));
      if (!insRet.acknowledged) {
        return ResultUtil.error(coreMessages.C00_DBError);
      }
      return ResultUtil.success(newData);
    }
    const query = { channel_id: channelId };
    const data = (await this.SplaJinroData.findOne(query)) as SplaJinroData | null;
    if (!data) {
      const { status, value } = await asyncInsertNewData();
      if (status != ResultOK) {
        return ResultUtil.error(status);
      }
      return ResultUtil.success(value);
    }
    if (data.version != SplaJinroDataVersion) {
      await this.SplaJinroData.deleteMany(query);
      // ここで新データを登録しても良いが、ユーザーが後日同じデータがあるから～と
      // 操作した時に首を傾げそうなので、明示しておく。
      return ResultUtil.error(coreMessages.C00_DataVersionNotSame);
    }
    return ResultUtil.success(data);
  }

  async asyncUpdateSplaJinroData(channelId: string, updateQuery: MatchKeysAndValues<SplaJinroData>): Promise<boolean> {
    const query = { channel_id: channelId };
    const updRet = (await this.SplaJinroData.updateOne(
      query,
      {
        $set: updateQuery,
        $currentDate: {
          last_update_datatime: true,
        },
      },
    ));
    if (!updRet.acknowledged || updRet.modifiedCount == 0) {
      return false;
    }
    return true;
  }

  async asyncDeleteSplaJinroData(channelId: string): Promise<boolean> {
    const query = { channel_id: channelId };
    const delRet = await this.SplaJinroData.deleteMany(query);
    if (!delRet.acknowledged || delRet.deletedCount == 0) {
      return false;
    }
    return true;
  }

  async asyncClearWorkData(): Promise<boolean> {
    const delRet = await this.WorkData.deleteMany({});
    if (!delRet.acknowledged) {
      return false;
    }
    return true;
  }
  async asyncInsertWorkData(WorkDataList: WorkData[]): Promise<boolean> {
    const insRet = (await this.WorkData.insertMany(WorkDataList));
    if (!insRet.acknowledged) {
      return false;
    }
    return true;
  }
  async asyncSelectWorkDataForEach(uuid: string, asc: boolean, func: (data: WorkData) => Promise<void>): Promise<void> {
    const query = { process_uuid: uuid };
    const cursor = this.WorkData.find(query).sort({ sorter: asc ? 1 : -1 });
    while (await cursor.hasNext()) {
      const data = await cursor.next();
      if (data) {
        await func(data);
      }
    }
  }
  async asyncDeleteWorkData(uuid: string): Promise<boolean> {
    const delRet = await this.WorkData.deleteMany({ process_uuid: uuid });
    if (!delRet.acknowledged) {
      return false;
    }
    return true;
  }

  async asyncSelectGambleSessionForce(channelId: string): Promise<Result<GambleSession>> {
    const asyncInsertNewData = async (): Promise<Result<GambleSession>> => {
      const newData = DBUtils.createNewGambleSessionObj(channelId);
      const insRet = await this.GambleSession.insertOne(newData);
      if (!insRet.acknowledged) {
        return ResultUtil.error(coreMessages.C00_DBError);
      }
      return ResultUtil.success(newData);
    }

    const query = { channel_id: channelId };
    const data = await this.GambleSession.findOne(query) as GambleSession | null;
    if (!data) {
      return await asyncInsertNewData();
    }

    if (data.version != GambleSessionVersion) {
      await this.GambleSession.deleteMany(query);
      return ResultUtil.error(coreMessages.C00_DataVersionNotSame);
    }
    return ResultUtil.success(data);
  }

  async asyncUpdateGambleSession(channelId: string, updateQuery: MatchKeysAndValues<GambleSession>): Promise<boolean> {
    const query = { channel_id: channelId };
    const updRet = (await this.GambleSession.updateOne(
      query,
      {
        $set: updateQuery,
        $currentDate: {
          last_sync_datatime: true,
        },
      },
    ));
    if (!updRet.acknowledged || updRet.modifiedCount == 0) {
      return false;
    }
    return true;
  }

}
