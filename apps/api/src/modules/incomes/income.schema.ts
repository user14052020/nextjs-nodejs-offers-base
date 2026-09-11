import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IncomeDocument = Income & Document;
export type IncomeSource = 'kwork' | 'manual';
export type IncomePaymentMethod = 'platform' | 'bank_account' | 'card_transfer' | 'cash' | 'other';
export type IncomeConfirmationDocumentType = 'platform_report' | 'receipt' | 'none';

@Schema({ timestamps: true })
export class Income {
  @Prop({ required: true, enum: ['kwork', 'manual'], default: 'manual' })
  source: IncomeSource;

  @Prop({ required: true })
  sourceName: string;

  @Prop({ required: true })
  incomeDate: Date;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ trim: true })
  customerName?: string;

  @Prop({ trim: true })
  orderTitle?: string;

  @Prop({ required: true, min: 0 })
  grossAmount: number;

  @Prop({ required: true, min: 0 })
  netAmount: number;

  @Prop({ required: true, min: 0, default: 0 })
  platformCommission: number;

  @Prop({ required: true, min: 0, default: 0 })
  payoutCommission: number;

  @Prop({ default: 'RUB' })
  currency: string;

  @Prop({ default: true })
  isReceived: boolean;

  @Prop({ required: true, enum: ['platform', 'bank_account', 'card_transfer', 'cash', 'other'], default: 'other' })
  paymentMethod: IncomePaymentMethod;

  @Prop({ required: true, enum: ['platform_report', 'receipt', 'none'], default: 'none' })
  confirmationDocumentType: IncomeConfirmationDocumentType;

  @Prop({ trim: true })
  receiptNumber?: string;

  @Prop()
  receiptDate?: Date;

  @Prop()
  receiptYear?: number;

  @Prop({ trim: true })
  settlementPlace?: string;

  @Prop({ default: 'ПСН', trim: true })
  taxRegime: string;

  @Prop({ default: 'ККТ не применяется: ПСН, п. 2.1 ст. 2 54-ФЗ', trim: true })
  cashRegisterExemptionReason: string;
}

export const IncomeSchema = SchemaFactory.createForClass(Income);
IncomeSchema.index({ incomeDate: -1, source: 1 });
IncomeSchema.index(
  { confirmationDocumentType: 1, receiptYear: 1, receiptNumber: 1 },
  {
    name: 'confirmationDocumentType_1_receiptYear_1_receiptNumber_1',
    unique: true,
    partialFilterExpression: { receiptNumber: { $type: 'string' } }
  }
);
