import { GambleRepository } from './repositories/gambleRepository';
import { SplaJinroRepository } from './repositories/splajinroRepository';
import { GambleSession } from './models/gamble';
import { SplaJinroData } from './models/splajinro';

export class DBUtils {
  static createNewSplaJinroDataObj = (channelId: string): SplaJinroData => {
    return SplaJinroRepository.createNewSplaJinroDataObj(channelId);
  }

  static createNewGambleSessionObj = (channelId: string): GambleSession => {
    return GambleRepository.createNewGambleSessionObj(channelId);
  }
}
