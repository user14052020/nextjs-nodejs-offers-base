import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';

import { Client, ClientDocument } from './client.schema';

@Injectable()
export class ClientsRepository {
  constructor(@InjectModel(Client.name) private readonly clientModel: Model<ClientDocument>) {}

  async findAll() {
    return this.clientModel
      .find()
      .populate('files', '_id filename mimeType size createdAt')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByIds(ids: string[]) {
    return this.clientModel
      .find({ _id: { $in: ids } })
      .populate('files', '_id filename mimeType size createdAt')
      .exec();
  }

  async findById(id: string) {
    return this.clientModel
      .findById(id)
      .populate('files', '_id filename mimeType size createdAt')
      .exec();
  }

  async create(payload: Partial<Client>, session?: ClientSession) {
    const created = new this.clientModel(payload);
    return created.save({ session });
  }

  async update(id: string, payload: Partial<Client>, session?: ClientSession) {
    return this.clientModel
      .findByIdAndUpdate(id, payload, { new: true, session })
      .populate('files', '_id filename mimeType size createdAt')
      .exec();
  }

  async delete(id: string, session?: ClientSession) {
    return this.clientModel.findByIdAndDelete(id, { session }).exec();
  }

  async addFile(id: string, fileId: Types.ObjectId, session?: ClientSession) {
    return this.clientModel
      .findByIdAndUpdate(id, { $addToSet: { files: fileId } }, { new: true, session })
      .populate('files', '_id filename mimeType size createdAt')
      .exec();
  }

  async removeFile(id: string, fileId: Types.ObjectId, session?: ClientSession) {
    return this.clientModel
      .findByIdAndUpdate(id, { $pull: { files: fileId } }, { new: true, session })
      .populate('files', '_id filename mimeType size createdAt')
      .exec();
  }
}
