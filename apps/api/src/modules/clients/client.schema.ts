import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ClientDocument = Client & Document;

@Schema({ timestamps: true })
export class Client {
  @Prop({ required: true })
  name: string;

  @Prop()
  inn?: string;

  @Prop()
  kpp?: string;

  @Prop()
  bankAccount?: string;

  @Prop()
  bankName?: string;

  @Prop()
  bik?: string;

  @Prop()
  correspondentAccount?: string;

  @Prop()
  address?: string;

  @Prop()
  email?: string;

  @Prop()
  phone?: string;

  @Prop()
  contract?: string;

  @Prop()
  signerName?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'File' }], default: [] })
  files: Types.ObjectId[];
}

export const ClientSchema = SchemaFactory.createForClass(Client);
