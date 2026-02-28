import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';

import { Work, WorkDocument } from './work.schema';

export type MonthlyClientReportAggregateRow = {
  year: number;
  month: number;
  clientId: string;
  clientName: string;
  worksCount: number;
  totalAmount: number;
};

@Injectable()
export class WorksRepository {
  constructor(@InjectModel(Work.name) private readonly workModel: Model<WorkDocument>) {}

  // Restored backups can contain legacy string _id values, so raw collection fallback
  // intentionally bypasses ObjectId-only typing.
  private rawIdFilter(id: string) {
    return { _id: id } as any;
  }

  private idCandidates(id: string) {
    if (Types.ObjectId.isValid(id)) {
      return [id, new Types.ObjectId(id)];
    }

    return [id];
  }

  private idsCandidates(ids: string[]) {
    const candidates: Array<string | Types.ObjectId> = [];
    const unique = new Set<string>();

    for (const id of ids) {
      if (!id || unique.has(id)) {
        continue;
      }

      unique.add(id);
      candidates.push(id);

      if (Types.ObjectId.isValid(id)) {
        candidates.push(new Types.ObjectId(id));
      }
    }

    return candidates;
  }

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

  async ensureReportingIndexes() {
    await this.workModel.collection.createIndex(
      { createdAt: -1 },
      { name: 'createdAt_-1' }
    );

    await this.workModel.collection.createIndex(
      { actDate: -1, clientId: 1 },
      { name: 'actDate_-1_clientId_1' }
    );
  }

  async findAll() {
    return this.workModel.find().sort({ createdAt: -1 }).exec();
  }

  async findByIds(ids: string[]) {
    return this.workModel.find({ _id: { $in: this.idsCandidates(ids) } }).exec();
  }

  async findById(id: string) {
    const found = await this.workModel.findOne({ _id: { $in: this.idCandidates(id) } }).exec();
    if (found) {
      return found;
    }

    const raw = await this.workModel.collection.findOne(this.rawIdFilter(id));
    return raw ? this.workModel.hydrate(raw) : null;
  }

  async create(payload: Partial<Work>, session?: ClientSession) {
    const created = new this.workModel(payload);
    return created.save({ session });
  }

  async update(id: string, payload: Partial<Work>, session?: ClientSession) {
    const updated = await this.workModel
      .findOneAndUpdate({ _id: { $in: this.idCandidates(id) } }, payload, { new: true, session })
      .exec();
    if (updated) {
      return updated;
    }

    const rawResult = await this.workModel.collection.findOneAndUpdate(
      this.rawIdFilter(id),
      { $set: payload },
      { returnDocument: 'after', session }
    );
    const raw = this.unwrapCollectionResult(rawResult);
    return raw ? this.workModel.hydrate(raw) : null;
  }

  async delete(id: string, session?: ClientSession) {
    const removed = await this.workModel
      .findOneAndDelete({ _id: { $in: this.idCandidates(id) } }, { session })
      .exec();
    if (removed) {
      return removed;
    }

    const rawResult = await this.workModel.collection.findOneAndDelete(this.rawIdFilter(id), { session });
    const raw = this.unwrapCollectionResult(rawResult);
    return raw ? this.workModel.hydrate(raw) : null;
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

  async aggregateMonthlyClientReport(): Promise<MonthlyClientReportAggregateRow[]> {
    return this.workModel.aggregate<MonthlyClientReportAggregateRow>([
      {
        $addFields: {
          actDateParsed: {
            $convert: { input: '$actDate', to: 'date', onError: null, onNull: null }
          },
          invoiceDateParsed: {
            $convert: { input: '$invoiceDate', to: 'date', onError: null, onNull: null }
          }
        }
      },
      {
        $addFields: {
          reportDate: { $ifNull: ['$actDateParsed', '$invoiceDateParsed'] }
        }
      },
      {
        $match: {
          reportDate: { $ne: null }
        }
      },
      {
        $project: {
          year: { $year: '$reportDate' },
          month: { $month: '$reportDate' },
          clientId: '$clientId',
          itemsCount: {
            $cond: [{ $isArray: '$items' }, { $size: '$items' }, 0]
          },
          amount: { $convert: { input: '$amount', to: 'double', onError: 0, onNull: 0 } }
        }
      },
      {
        $group: {
          _id: {
            year: '$year',
            month: '$month',
            clientId: '$clientId'
          },
          worksCount: { $sum: '$itemsCount' },
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $lookup: {
          from: 'clients',
          localField: '_id.clientId',
          foreignField: '_id',
          as: 'client'
        }
      },
      { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          clientId: {
            $ifNull: [{ $toString: '$_id.clientId' }, '__unknown_client__']
          },
          clientName: { $ifNull: ['$client.name', 'Клиент не найден'] },
          worksCount: 1,
          totalAmount: 1
        }
      },
      { $sort: { year: -1, month: -1, totalAmount: -1, worksCount: -1, clientName: 1 } }
    ]);
  }

  private unwrapCollectionResult<T>(result: T | { value?: T | null } | null | undefined): T | null {
    if (!result) {
      return null;
    }

    if (typeof result === 'object' && 'value' in (result as Record<string, unknown>)) {
      const value = (result as { value?: T | null }).value;
      return value ?? null;
    }

    return result as T;
  }
}
