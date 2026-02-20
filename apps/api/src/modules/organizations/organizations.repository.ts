import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';

import { Organization, OrganizationDocument } from './organization.schema';

@Injectable()
export class OrganizationsRepository {
  constructor(
    @InjectModel(Organization.name)
    private readonly organizationModel: Model<OrganizationDocument>
  ) {}

  async findAll() {
    return this.organizationModel
      .find()
      .populate('files', '_id filename mimeType size createdAt')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByIds(ids: string[]) {
    return this.organizationModel
      .find({ _id: { $in: ids } })
      .populate('files', '_id filename mimeType size createdAt')
      .exec();
  }

  async findById(id: string) {
    return this.organizationModel
      .findById(id)
      .populate('files', '_id filename mimeType size createdAt')
      .exec();
  }

  async create(payload: Partial<Organization>, session?: ClientSession) {
    const created = new this.organizationModel(payload);
    return created.save({ session });
  }

  async update(id: string, payload: Partial<Organization>, session?: ClientSession) {
    return this.organizationModel
      .findByIdAndUpdate(id, payload, { new: true, session })
      .populate('files', '_id filename mimeType size createdAt')
      .exec();
  }

  async delete(id: string, session?: ClientSession) {
    return this.organizationModel.findByIdAndDelete(id, { session }).exec();
  }

  async addFile(id: string, fileId: Types.ObjectId, session?: ClientSession) {
    return this.organizationModel
      .findByIdAndUpdate(id, { $addToSet: { files: fileId } }, { new: true, session })
      .populate('files', '_id filename mimeType size createdAt')
      .exec();
  }

  async removeFile(id: string, fileId: Types.ObjectId, session?: ClientSession) {
    return this.organizationModel
      .findByIdAndUpdate(id, { $pull: { files: fileId } }, { new: true, session })
      .populate('files', '_id filename mimeType size createdAt')
      .exec();
  }
}
