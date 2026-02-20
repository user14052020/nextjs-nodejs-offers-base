import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';

import { Sequence, SequenceDocument } from './sequence.schema';

@Injectable()
export class SequencesService {
  constructor(@InjectModel(Sequence.name) private readonly sequenceModel: Model<SequenceDocument>) {}

  async next(name: string, session?: ClientSession): Promise<number> {
    const updated = await this.sequenceModel
      .findOneAndUpdate({ name }, { $inc: { value: 1 } }, { new: true, upsert: true, session })
      .exec();
    return updated.value;
  }
}
