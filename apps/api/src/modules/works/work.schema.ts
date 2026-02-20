import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WorkDocument = Work & Document;

@Schema({ _id: false })
export class WorkItem {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, min: 0.000001 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, min: 0 })
  amount: number;
}

export const WorkItemSchema = SchemaFactory.createForClass(WorkItem);

@Schema({ timestamps: true })
export class Work {
  @Prop({ type: [WorkItemSchema], default: [] })
  items: WorkItem[];

  @Prop({ required: true })
  amount: number;

  @Prop({ default: 'RUB' })
  currency?: string;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  executorOrganizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Client', required: true })
  clientId: Types.ObjectId;

  @Prop({ required: true })
  actNumber: string;

  @Prop({ required: true })
  invoiceNumber: string;

  @Prop({ required: true })
  actDate: Date;

  @Prop({ required: true })
  invoiceDate: Date;

  @Prop({ required: true })
  actYear: number;

  @Prop({ required: true })
  invoiceYear: number;
}

export const WorkSchema = SchemaFactory.createForClass(Work);
WorkSchema.index({ actYear: 1, actNumber: 1 }, { unique: true });
WorkSchema.index({ invoiceYear: 1, invoiceNumber: 1 }, { unique: true });
