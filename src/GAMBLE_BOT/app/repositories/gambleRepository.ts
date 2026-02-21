import { Collection, MatchKeysAndValues } from 'mongodb';
import { Result, ResultUtil } from '../Result';
import { eMessage } from '../Const';
import {
  GambleGame,
  GambleSession,
  GambleGameStatus,
  GambleBet,
  GambleLedger,
  GambleOddsMode,
  GambleSessionVersion,
  UserBalance,
} from '../models/gamble';
import { buildPayoutSummary, PayoutSummary } from '../gamble/Payout';
import { MongoClientManager } from '../core/db/mongoClient';

export type ResolveGameResult = {
  game: GambleGame,
  summary: PayoutSummary,
}

export class GambleRepository {
  private constructor(
    private readonly gambleSession: Collection<GambleSession>,
    private readonly gambleGame: Collection<GambleGame>,
    private readonly gambleLedger: Collection<GambleLedger>,
    private readonly userBalance: Collection<UserBalance>,
    private readonly gambleBet: Collection<GambleBet>,
  ) {}

  static createNewGambleSessionObj(channelId: string): GambleSession {
    return {
      sessionId: '',
      guildId: '',
      channelId: channelId,
      gmPasswordHash: '',
      syncSheet: {
        spreadsheetId: '',
        sheetName: '',
      },
      initialPoint: 10000,
      spreadsheetId: '',
      sheetName: '',
      credentialRef: '',
      users_balance: [],
      bets: [],
      ledger: [],
      last_sync_datatime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: GambleSessionVersion,
    };
  }

  private static nowDate(): Date {
    return new Date();
  }

  static async connect(): Promise<GambleRepository> {
    const db = await MongoClientManager.getDb();
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

    return new GambleRepository(gambleSession, gambleGame, gambleLedger, userBalance, gambleBet);
  }

  async asyncCreateOrUpdateGambleSession(params: {
    sessionId: string,
    guildId: string,
    channelId: string,
    gmPasswordHash: string,
    syncSheet: GambleSession['syncSheet'],
    initialPoint: number,
  }): Promise<GambleSession> {
    return await MongoClientManager.handleError('asyncCreateOrUpdateGambleSession', async () => {
      const now = GambleRepository.nowDate();
      await this.gambleSession.updateOne(
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
      const session = await this.gambleSession.findOne({ sessionId: params.sessionId });
      if (!session) {
        throw new Error('failed to create or update gamble session');
      }
      return session;
    });
  }

  async asyncUpdateGambleSessionPassword(sessionId: string, gmPasswordHash: string): Promise<boolean> {
    return await MongoClientManager.handleError('asyncUpdateGambleSessionPassword', async () => {
      const updRet = await this.gambleSession.updateOne(
        { sessionId },
        {
          $set: {
            gmPasswordHash,
            updatedAt: GambleRepository.nowDate(),
          },
        },
      );
      return updRet.acknowledged && updRet.modifiedCount > 0;
    });
  }

  async asyncUpdateGambleSessionSyncSheet(sessionId: string, syncSheet: GambleSession['syncSheet']): Promise<boolean> {
    return await MongoClientManager.handleError('asyncUpdateGambleSessionSyncSheet', async () => {
      const updRet = await this.gambleSession.updateOne(
        { sessionId },
        {
          $set: {
            syncSheet,
            updatedAt: GambleRepository.nowDate(),
          },
        },
      );
      return updRet.acknowledged && updRet.modifiedCount > 0;
    });
  }

  async asyncStartGambleGame(sessionId: string, gameId: string, oddsMode: GambleOddsMode): Promise<GambleGame> {
    return await MongoClientManager.handleError('asyncStartGambleGame', async () => {
      const now = GambleRepository.nowDate();
      await this.gambleGame.insertOne({
        sessionId,
        gameId,
        status: 'open',
        bets: [],
        resolvedAt: null,
        winningTicket: undefined,
        oddsMode: oddsMode,
        resolvedTicket: undefined,
        createdAt: now,
        updatedAt: now,
      });
      const game = await this.gambleGame.findOne({ sessionId, gameId });
      if (!game) {
        throw new Error('failed to start gamble game');
      }
      return game;
    });
  }

  async asyncCloseGambleGame(sessionId: string, gameId: string): Promise<boolean> {
    return await MongoClientManager.handleError('asyncCloseGambleGame', async () => {
      const updRet = await this.gambleGame.updateOne(
        { sessionId, gameId, status: 'open' },
        {
          $set: {
            status: 'closed',
            updatedAt: GambleRepository.nowDate(),
          },
        },
      );
      return updRet.acknowledged && updRet.modifiedCount > 0;
    });
  }

  async asyncResolveGambleGame(sessionId: string, gameId: string, resolvedTicket: string): Promise<boolean> {
    return await MongoClientManager.handleError('asyncResolveGambleGame', async () => {
      const updRet = await this.gambleGame.updateOne(
        { sessionId, gameId, status: { $in: ['open', 'closed'] } },
        {
          $set: {
            status: 'resolved',
            resolvedTicket,
            updatedAt: GambleRepository.nowDate(),
          },
        },
      );
      return updRet.acknowledged && updRet.modifiedCount > 0;
    });
  }

  async asyncInsertGambleBet(sessionId: string, bet: Omit<GambleBet, 'sessionId' | 'createdAt'>): Promise<Result<GambleBet>> {
    return await MongoClientManager.handleError('asyncInsertGambleBet', async () => {
      const game = await this.gambleGame.findOne({ sessionId, gameId: bet.gameId });
      if (!game) {
        return ResultUtil.error(eMessage.C00_NoData);
      }
      if (game.status !== 'open') {
        return ResultUtil.error(eMessage.C00_DBError);
      }

      const existingBet = await this.gambleBet.findOne({ sessionId, gameId: bet.gameId, userId: bet.userId });
      if (existingBet) {
        return ResultUtil.error(eMessage.C00_DBError);
      }
      const doc: GambleBet = {
        sessionId,
        gameId: bet.gameId,
        userId: bet.userId,
        ticket: bet.ticket,
        point: bet.point,
        amount: bet.amount,
        createdAt: GambleRepository.nowDate(),
      };
      const insRet = await this.gambleBet.insertOne(doc);
      if (!insRet.acknowledged) {
        return ResultUtil.error(eMessage.C00_DBError);
      }
      return ResultUtil.success(doc);
    });
  }

  async asyncAddLedger(sessionId: string, ledger: Omit<GambleLedger, 'sessionId' | 'createdAt' | 'balanceAfter'>): Promise<Result<GambleLedger>> {
    return await MongoClientManager.handleError('asyncAddLedger', async () => {
      const latest = await this.gambleLedger.find({ sessionId, userId: ledger.userId }).sort({ createdAt: -1 }).limit(1).toArray();
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
        createdAt: GambleRepository.nowDate(),
        balanceAfter: nextBalance,
        note: ledger.note,
      };
      const insRet = await this.gambleLedger.insertOne(doc);
      if (!insRet.acknowledged) {
        return ResultUtil.error(eMessage.C00_DBError);
      }
      return ResultUtil.success(doc);
    });
  }

  async asyncGetGambleBalance(sessionId: string, userId: string): Promise<number> {
    return await MongoClientManager.handleError('asyncGetGambleBalance', async () => {
      const latest = await this.gambleLedger.find({ sessionId, userId }).sort({ createdAt: -1 }).limit(1).toArray();
      if (latest.length === 0) {
        const session = await this.gambleSession.findOne({ sessionId });
        return session?.initialPoint ?? 0;
      }
      return latest[0].balanceAfter;
    });
  }

  async asyncGetGambleLedgerHistory(sessionId: string, userId: string, limit = 50): Promise<GambleLedger[]> {
    return await MongoClientManager.handleError('asyncGetGambleLedgerHistory', async () => {
      return await this.gambleLedger.find({ sessionId, userId }).sort({ createdAt: -1 }).limit(limit).toArray();
    });
  }

  async asyncGetGambleGame(sessionId: string, gameId: string): Promise<GambleGame | null> {
    return await MongoClientManager.handleError('asyncGetGambleGame', async () => {
      return await this.gambleGame.findOne({ sessionId, gameId });
    });
  }

  async asyncUpdateGambleGameStatus(sessionId: string, gameId: string, status: GambleGameStatus): Promise<boolean> {
    return await MongoClientManager.handleError('asyncUpdateGambleGameStatus', async () => {
      const updRet = await this.gambleGame.updateOne(
        { sessionId, gameId },
        {
          $set: {
            status,
            updatedAt: GambleRepository.nowDate(),
          },
        },
      );
      return updRet.acknowledged && updRet.modifiedCount > 0;
    });
  }

  async asyncResolveGame(sessionId: string, gameId: string, winningTicket: string): Promise<ResolveGameResult> {
    return await MongoClientManager.handleError('asyncResolveGame', async () => {
      const now = new Date();
      return await MongoClientManager.withTransaction(async (mongoSession) => {
        const game = await this.gambleGame.findOne({ sessionId, gameId }, { session: mongoSession });
        if (!game) {
          throw new Error('対象ゲームが見つかりません。');
        }
        if (game.resolvedAt != null || game.status === 'resolved') {
          throw new Error('このゲームはすでに確定済みです。');
        }

        const summary = buildPayoutSummary(sessionId, gameId, game.bets, winningTicket);
        const ledgers: GambleLedger[] = summary.ledgerDrafts.map((draft) => ({
          ...draft,
          createdAt: now,
        }));

        const updateResult = await this.gambleGame.updateOne(
          {
            sessionId,
            gameId,
            resolvedAt: null,
          },
          {
            $set: {
              status: 'resolved',
              resolvedAt: now,
              winningTicket,
              updatedAt: now,
            },
          },
          { session: mongoSession },
        );

        if (!updateResult.acknowledged || updateResult.modifiedCount !== 1) {
          throw new Error('このゲームはすでに確定済みです。');
        }

        if (ledgers.length > 0) {
          await this.gambleLedger.insertMany(ledgers, { session: mongoSession });
        }

        const deltaByUserId = new Map<string, number>();
        for (const ledger of ledgers) {
          deltaByUserId.set(ledger.userId, (deltaByUserId.get(ledger.userId) ?? 0) + ledger.amount);
        }

        for (const [userId, delta] of deltaByUserId.entries()) {
          await this.userBalance.updateOne(
            { userId },
            {
              $inc: { balance: delta },
              $set: { updatedAt: now },
              $setOnInsert: { userId },
            },
            { upsert: true, session: mongoSession },
          );
        }

        return {
          game: {
            ...game,
            status: 'resolved',
            resolvedAt: now,
            winningTicket,
            updatedAt: now,
          },
          summary,
        };
      });
    });
  }

  async asyncSelectGambleSessionForce(channelId: string): Promise<Result<GambleSession>> {
    return await MongoClientManager.handleError('asyncSelectGambleSessionForce', async () => {
      const asyncInsertNewData = async (): Promise<Result<GambleSession>> => {
        const newData = GambleRepository.createNewGambleSessionObj(channelId);
        const insRet = await this.gambleSession.insertOne(newData);
        if (!insRet.acknowledged) {
          return ResultUtil.error(eMessage.C00_DBError);
        }
        return ResultUtil.success(newData);
      };

      const query = { channel_id: channelId };
      const data = await this.gambleSession.findOne(query) as GambleSession | null;
      if (!data) {
        return await asyncInsertNewData();
      }

      if (data.version != GambleSessionVersion) {
        await this.gambleSession.deleteMany(query);
        return ResultUtil.error(eMessage.C00_DataVersionNotSame);
      }
      return ResultUtil.success(data);
    });
  }

  async asyncUpdateGambleSession(channelId: string, updateQuery: MatchKeysAndValues<GambleSession>): Promise<boolean> {
    return await MongoClientManager.handleError('asyncUpdateGambleSession', async () => {
      const query = { channel_id: channelId };
      const updRet = await this.gambleSession.updateOne(
        query,
        {
          $set: updateQuery,
          $currentDate: {
            last_sync_datatime: true,
          },
        },
      );
      if (!updRet.acknowledged || updRet.modifiedCount == 0) {
        return false;
      }
      return true;
    });
  }
}
