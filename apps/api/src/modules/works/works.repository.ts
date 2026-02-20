import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';

import { Work, WorkDocument } from './work.schema';

@Injectable()
export class WorksRepository {
  constructor(@InjectModel(Work.name) private readonly workModel: Model<WorkDocument>) {}

  async backfillYears() {
    await this.workModel.updateMany(
      {
        $or: [{ actYear: { $exists: false } }, { invoiceYear: { $exists: false } }]
      },
      [
        {
          $set: {
            actYear: { $year: '$actDate' },
            invoiceYear: { $year: '$invoiceDate' }
          }
        }
      ]
    );
  }

  async ensureYearlyNumberIndexes() {
    const indexes = await this.workModel.collection.indexes();
    const legacyAct = indexes.find((index) => index.name === 'actNumber_1' && index.unique);
    if (legacyAct) {
      await this.workModel.collection.dropIndex('actNumber_1');
    }

    const legacyInvoice = indexes.find((index) => index.name === 'invoiceNumber_1' && index.unique);
    if (legacyInvoice) {
      await this.workModel.collection.dropIndex('invoiceNumber_1');
    }

    await this.workModel.collection.createIndex(
      { actYear: 1, actNumber: 1 },
      { unique: true, name: 'actYear_1_actNumber_1' }
    );
    await this.workModel.collection.createIndex(
      { invoiceYear: 1, invoiceNumber: 1 },
      { unique: true, name: 'invoiceYear_1_invoiceNumber_1' }
    );
  }

  async findAll() {
    return this.workModel.find().sort({ createdAt: -1 }).exec();
  }

  async findByIds(ids: string[]) {
    return this.workModel.find({ _id: { $in: ids } }).exec();
  }

  async findById(id: string) {
    return this.workModel.findById(id).exec();
  }

  async create(payload: Partial<Work>, session?: ClientSession) {
    const created = new this.workModel(payload);
    return created.save({ session });
  }

  async update(id: string, payload: Partial<Work>, session?: ClientSession) {
    return this.workModel.findByIdAndUpdate(id, payload, { new: true, session }).exec();
  }

  async delete(id: string, session?: ClientSession) {
    return this.workModel.findByIdAndDelete(id, { session }).exec();
  }

  async findByActNumberInYear(actNumber: string, actYear: number) {
    return this.workModel.findOne({ actNumber, actYear }).exec();
  }

  async findByInvoiceNumberInYear(invoiceNumber: string, invoiceYear: number) {
    return this.workModel.findOne({ invoiceNumber, invoiceYear }).exec();
  }

  async findMaxActNumberByYear(actYear: number): Promise<number> {
    const result = await this.workModel.aggregate<{ value: number }>([
      { $match: { actYear } },
      {
        $project: {
          value: {
            $convert: { input: '$actNumber', to: 'int', onError: 0, onNull: 0 }
          }
        }
      },
      { $sort: { value: -1 } },
      { $limit: 1 }
    ]);

    return result[0]?.value ?? 0;
  }

  async findMaxInvoiceNumberByYear(invoiceYear: number): Promise<number> {
    const result = await this.workModel.aggregate<{ value: number }>([
      { $match: { invoiceYear } },
      {
        $project: {
          value: {
            $convert: { input: '$invoiceNumber', to: 'int', onError: 0, onNull: 0 }
          }
        }
      },
      { $sort: { value: -1 } },
      { $limit: 1 }
    ]);

    return result[0]?.value ?? 0;
  }
}
