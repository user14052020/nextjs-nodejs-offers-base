import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, PipelineStage, Types } from 'mongoose';

import { Income, IncomeDocument } from './income.schema';

export type IncomeListRow = Income & {
  _id: Types.ObjectId | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export type MonthlyIncomeAggregateRow = {
  year: number;
  month: number;
  clientId: string;
  clientName: string;
  source: 'kwork' | 'manual';
  entriesCount: number;
  paidEntriesCount: number;
  grossAmount: number;
  netAmount: number;
  platformCommission: number;
  payoutCommission: number;
};

@Injectable()
export class IncomesRepository {
  constructor(@InjectModel(Income.name) private readonly incomeModel: Model<IncomeDocument>) {}

  private idCandidates(id: string) {
    if (Types.ObjectId.isValid(id)) {
      return [id, new Types.ObjectId(id)];
    }
    return [id];
  }

  async ensureIndexes() {
    await this.incomeModel.collection.createIndex(
      { incomeDate: -1, source: 1 },
      { name: 'incomeDate_-1_source_1' }
    );
    await this.incomeModel.collection.createIndex(
      { source: 1, incomeDate: 1, grossAmount: 1, netAmount: 1, description: 1 },
      { name: 'source_1_incomeDate_1_amounts_1_description_1' }
    );
    await this.incomeModel.collection.createIndex(
      { confirmationDocumentType: 1, receiptYear: 1, receiptNumber: 1 },
      {
        name: 'confirmationDocumentType_1_receiptYear_1_receiptNumber_1',
        unique: true,
        partialFilterExpression: { receiptNumber: { $type: 'string' } }
      }
    );
  }

  async backfillDefaults() {
    await this.incomeModel.updateMany(
      {
        $or: [
          { source: { $exists: false } },
          { sourceName: { $exists: false } },
          { platformCommission: { $exists: false } },
          { payoutCommission: { $exists: false } },
          { currency: { $exists: false } },
          { isReceived: { $exists: false } },
          { paymentMethod: { $exists: false } },
          { confirmationDocumentType: { $exists: false } },
          { receiptDate: { $exists: false } },
          { receiptYear: { $exists: false } },
          { taxRegime: { $exists: false } },
          { cashRegisterExemptionReason: { $exists: false } }
        ]
      },
      [
        {
          $set: {
            source: { $ifNull: ['$source', 'manual'] },
            sourceName: { $ifNull: ['$sourceName', 'Ручной доход'] },
            platformCommission: { $ifNull: ['$platformCommission', 0] },
            payoutCommission: { $ifNull: ['$payoutCommission', 0] },
            currency: { $ifNull: ['$currency', 'RUB'] },
            isReceived: { $ifNull: ['$isReceived', true] },
            paymentMethod: {
              $ifNull: [
                '$paymentMethod',
                { $cond: [{ $eq: ['$source', 'kwork'] }, 'platform', 'card_transfer'] }
              ]
            },
            confirmationDocumentType: {
              $ifNull: [
                '$confirmationDocumentType',
                { $cond: [{ $eq: ['$source', 'kwork'] }, 'platform_report', 'receipt'] }
              ]
            },
            receiptDate: {
              $ifNull: [
                '$receiptDate',
                {
                  $cond: [
                    {
                      $eq: [
                        {
                          $ifNull: [
                            '$confirmationDocumentType',
                            { $cond: [{ $eq: ['$source', 'kwork'] }, 'platform_report', 'receipt'] }
                          ]
                        },
                        'receipt'
                      ]
                    },
                    '$incomeDate',
                    '$receiptDate'
                  ]
                }
              ]
            },
            receiptYear: {
              $ifNull: [
                '$receiptYear',
                {
                  $cond: [
                    {
                      $eq: [
                        {
                          $ifNull: [
                            '$confirmationDocumentType',
                            { $cond: [{ $eq: ['$source', 'kwork'] }, 'platform_report', 'receipt'] }
                          ]
                        },
                        'receipt'
                      ]
                    },
                    { $year: { date: { $ifNull: ['$receiptDate', '$incomeDate'] }, timezone: 'UTC' } },
                    '$receiptYear'
                  ]
                }
              ]
            },
            taxRegime: { $ifNull: ['$taxRegime', 'ПСН'] },
            cashRegisterExemptionReason: {
              $ifNull: ['$cashRegisterExemptionReason', 'ККТ не применяется: ПСН, п. 2.1 ст. 2 54-ФЗ']
            }
          }
        }
      ]
    );
  }

  async backfillDates() {
    await this.incomeModel.updateMany(
      {
        $or: [{ incomeDate: { $type: 'string' } }, { receiptDate: { $type: 'string' } }]
      },
      [
        {
          $set: {
            incomeDate: {
              $convert: { input: '$incomeDate', to: 'date', onError: '$incomeDate', onNull: '$incomeDate' }
            },
            receiptDate: {
              $convert: { input: '$receiptDate', to: 'date', onError: '$receiptDate', onNull: '$receiptDate' }
            }
          }
        }
      ]
    );
  }

  async findById(id: string) {
    return this.incomeModel.findOne({ _id: { $in: this.idCandidates(id) } }).exec();
  }

  async findReceiptByNumber(receiptYear: number, receiptNumber: string, excludeId?: string) {
    return this.incomeModel
      .findOne({
        confirmationDocumentType: 'receipt',
        receiptYear,
        receiptNumber,
        ...(excludeId ? { _id: { $nin: this.idCandidates(excludeId) } } : {})
      })
      .exec();
  }

  async findAll(): Promise<IncomeListRow[]> {
    return this.incomeModel
      .aggregate<IncomeListRow>([
        {
          $addFields: {
            __incomeDateSort: {
              $convert: { input: '$incomeDate', to: 'date', onError: null, onNull: null }
            },
            __createdAtSort: {
              $convert: { input: '$createdAt', to: 'date', onError: null, onNull: null }
            }
          }
        },
        { $sort: { __incomeDateSort: -1, __createdAtSort: -1, _id: -1 } },
        { $unset: ['__incomeDateSort', '__createdAtSort'] }
      ])
      .exec();
  }

  async create(payload: Partial<Income>, session?: ClientSession) {
    const created = new this.incomeModel(payload);
    return created.save({ session });
  }

  async update(id: string, payload: Partial<Income>, session?: ClientSession) {
    const set = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
    const unset = Object.fromEntries(Object.entries(payload).filter(([, value]) => value === undefined).map(([key]) => [key, 1]));
    const update: Record<string, unknown> = {};
    if (Object.keys(set).length > 0) {
      update.$set = set;
    }
    if (Object.keys(unset).length > 0) {
      update.$unset = unset;
    }

    return this.incomeModel
      .findOneAndUpdate({ _id: { $in: this.idCandidates(id) } }, update, { new: true, session })
      .exec();
  }

  async delete(id: string, session?: ClientSession) {
    return this.incomeModel.findOneAndDelete({ _id: { $in: this.idCandidates(id) } }, { session }).exec();
  }

  async findDuplicateImportCandidates(payload: {
    incomeDate: Date;
    description: string;
    grossAmount: number;
    netAmount: number;
  }) {
    return this.incomeModel
      .find({
        source: 'kwork',
        incomeDate: payload.incomeDate,
        description: payload.description,
        grossAmount: payload.grossAmount,
        netAmount: payload.netAmount
      })
      .exec();
  }

  async aggregateMonthlyReport(options: { receivedOnly: boolean }): Promise<MonthlyIncomeAggregateRow[]> {
    const pipeline: PipelineStage[] = [
      ...(options.receivedOnly ? [{ $match: { isReceived: true } }] : []),
      {
        $addFields: {
          incomeDateParsed: {
            $convert: { input: '$incomeDate', to: 'date', onError: null, onNull: null }
          }
        }
      },
      { $match: { incomeDateParsed: { $ne: null } } },
      {
        $project: {
          year: { $year: '$incomeDateParsed' },
          month: { $month: '$incomeDateParsed' },
          source: { $ifNull: ['$source', 'manual'] },
          clientId: {
            $concat: [
              { $ifNull: ['$source', 'manual'] },
              ':',
              {
                $trim: {
                  input: {
                    $ifNull: ['$customerName', '$sourceName']
                  }
                }
              }
            ]
          },
          clientName: {
            $concat: [
              {
                $cond: [{ $eq: ['$source', 'kwork'] }, 'Kwork: ', 'Доход: ']
              },
              {
                $trim: {
                  input: {
                    $ifNull: ['$customerName', '$sourceName']
                  }
                }
              }
            ]
          },
          entriesCount: { $literal: 1 },
          paidEntriesCount: {
            $cond: [{ $eq: ['$isReceived', true] }, 1, 0]
          },
          grossAmount: { $convert: { input: '$grossAmount', to: 'double', onError: 0, onNull: 0 } },
          netAmount: { $convert: { input: '$netAmount', to: 'double', onError: 0, onNull: 0 } },
          platformCommission: {
            $convert: { input: '$platformCommission', to: 'double', onError: 0, onNull: 0 }
          },
          payoutCommission: {
            $convert: { input: '$payoutCommission', to: 'double', onError: 0, onNull: 0 }
          }
        }
      },
      {
        $group: {
          _id: {
            year: '$year',
            month: '$month',
            clientId: '$clientId',
            clientName: '$clientName',
            source: '$source'
          },
          entriesCount: { $sum: 1 },
          paidEntriesCount: { $sum: '$paidEntriesCount' },
          grossAmount: { $sum: '$grossAmount' },
          netAmount: { $sum: '$netAmount' },
          platformCommission: { $sum: '$platformCommission' },
          payoutCommission: { $sum: '$payoutCommission' }
        }
      },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          clientId: '$_id.clientId',
          clientName: '$_id.clientName',
          source: '$_id.source',
          entriesCount: 1,
          paidEntriesCount: 1,
          grossAmount: 1,
          netAmount: 1,
          platformCommission: 1,
          payoutCommission: 1
        }
      },
      { $sort: { year: -1, month: -1, grossAmount: -1, entriesCount: -1, clientName: 1 } }
    ];

    return this.incomeModel.aggregate<MonthlyIncomeAggregateRow>(pipeline);
  }
}
