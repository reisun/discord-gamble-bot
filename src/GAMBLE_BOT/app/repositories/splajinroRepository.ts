import { Collection, MatchKeysAndValues } from 'mongodb';
import { Result, ResultOK, ResultUtil } from '../Result';
import { eMessage } from '../Const';
import { SplaJinroData, SplaJinroDataVersion } from '../models/splajinro';
import { WorkData } from '../models/common';
import { MongoClientManager } from '../core/db/mongoClient';

export class SplaJinroRepository {
  private constructor(
    private readonly splaJinroData: Collection<SplaJinroData>,
    private readonly workData: Collection<WorkData>,
  ) {}

  static createNewSplaJinroDataObj(channelId: string): SplaJinroData {
    return {
      channel_id: channelId,
      add_member_list: [],
      ignore_member_list: [],
      prev_suggest_role_command_string: '',
      prev_send_role_command_string: '',
      eject_member_list: [],
      send_role_option: '狂人>知れる>人狼',
      last_update_datatime: new Date(),
      version: SplaJinroDataVersion,
    };
  }

  static async connect(): Promise<SplaJinroRepository> {
    const db = await MongoClientManager.getDb();
    return new SplaJinroRepository(
      db.collection<SplaJinroData>('SplaJinroData'),
      db.collection<WorkData>('WorkData'),
    );
  }

  async asyncSelectSplaJinroDataForce(channelId: string): Promise<Result<SplaJinroData>> {
    return await MongoClientManager.handleError('asyncSelectSplaJinroDataForce', async () => {
      const asyncInsertNewData = async (): Promise<Result<SplaJinroData>> => {
        const newData = SplaJinroRepository.createNewSplaJinroDataObj(channelId);
        const insRet = (await this.splaJinroData.insertOne(newData));
        if (!insRet.acknowledged) {
          return ResultUtil.error(eMessage.C00_DBError);
        }
        return ResultUtil.success(newData);
      };

      const query = { channel_id: channelId };
      const data = (await this.splaJinroData.findOne(query)) as SplaJinroData | null;
      if (!data) {
        const { status, value } = await asyncInsertNewData();
        if (status != ResultOK) {
          return ResultUtil.error(status);
        }
        return ResultUtil.success(value);
      }
      if (data.version != SplaJinroDataVersion) {
        await this.splaJinroData.deleteMany(query);
        return ResultUtil.error(eMessage.C00_DataVersionNotSame);
      }
      return ResultUtil.success(data);
    });
  }

  async asyncUpdateSplaJinroData(channelId: string, updateQuery: MatchKeysAndValues<SplaJinroData>): Promise<boolean> {
    return await MongoClientManager.handleError('asyncUpdateSplaJinroData', async () => {
      const query = { channel_id: channelId };
      const updRet = await this.splaJinroData.updateOne(
        query,
        {
          $set: updateQuery,
          $currentDate: {
            last_update_datatime: true,
          },
        },
      );
      if (!updRet.acknowledged || updRet.modifiedCount == 0) {
        return false;
      }
      return true;
    });
  }

  async asyncDeleteSplaJinroData(channelId: string): Promise<boolean> {
    return await MongoClientManager.handleError('asyncDeleteSplaJinroData', async () => {
      const query = { channel_id: channelId };
      const delRet = await this.splaJinroData.deleteMany(query);
      if (!delRet.acknowledged || delRet.deletedCount == 0) {
        return false;
      }
      return true;
    });
  }

  async asyncClearWorkData(): Promise<boolean> {
    return await MongoClientManager.handleError('asyncClearWorkData', async () => {
      const delRet = await this.workData.deleteMany({});
      if (!delRet.acknowledged) {
        return false;
      }
      return true;
    });
  }

  async asyncInsertWorkData(workDataList: WorkData[]): Promise<boolean> {
    return await MongoClientManager.handleError('asyncInsertWorkData', async () => {
      const insRet = await this.workData.insertMany(workDataList);
      if (!insRet.acknowledged) {
        return false;
      }
      return true;
    });
  }

  async asyncSelectWorkDataForEach(uuid: string, asc: boolean, func: (data: WorkData) => Promise<void>): Promise<void> {
    await MongoClientManager.handleError('asyncSelectWorkDataForEach', async () => {
      const query = { process_uuid: uuid };
      const cursor = this.workData.find(query).sort({ sorter: asc ? 1 : -1 });
      while (await cursor.hasNext()) {
        const data = await cursor.next();
        if (data) {
          await func(data);
        }
      }
    });
  }

  async asyncDeleteWorkData(uuid: string): Promise<boolean> {
    return await MongoClientManager.handleError('asyncDeleteWorkData', async () => {
      const delRet = await this.workData.deleteMany({ process_uuid: uuid });
      if (!delRet.acknowledged) {
        return false;
      }
      return true;
    });
  }
}
