import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrganizationDocument = Organization & Document;

@Schema({ timestamps: true })
export class Organization {
  @Prop({ required: true })
  name: string;

  @Prop()
  shortName?: string;

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
  signerName?: string;

  @Prop()
  chiefAccountant?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'File' }], default: [] })
  files: Types.ObjectId[];
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
