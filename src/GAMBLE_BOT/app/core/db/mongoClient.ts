import { Db, MongoClient, ClientSession, TransactionOptions } from 'mongodb';
import config from '../../config';

export class MongoClientManager {
  private static client: MongoClient | null = null;

  static async connect(): Promise<MongoClient> {
    if (!MongoClientManager.client) {
      MongoClientManager.client = await MongoClient.connect(config.mongodbUri);
    }
    return MongoClientManager.client;
  }

  static async getDb(): Promise<Db> {
    const client = await MongoClientManager.connect();
    return client.db('appData');
  }

  static async withTransaction<T>(
    callback: (session: ClientSession) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    const client = await MongoClientManager.connect();
    const session = client.startSession();
    try {
      let result: T | null = null;
      await session.withTransaction(async () => {
        result = await callback(session);
      }, options);
      if (result === null) {
        throw new Error('transaction returned no result');
      }
      return result;
    }
    finally {
      await session.endSession();
    }
  }

  static async handleError<T>(context: string, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    }
    catch (error) {
      console.error(`[MongoDB:${context}]`, error);
      throw error;
    }
  }
}
