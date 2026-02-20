import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { File, FileDocument } from './file.schema';

@Injectable()
export class FilesRepository {
  constructor(@InjectModel(File.name) private readonly fileModel: Model<FileDocument>) {}

  async create(payload: Partial<File>) {
    const created = new this.fileModel(payload);
    return created.save();
  }

  async findById(id: string) {
    return this.fileModel.findById(id).exec();
  }

  async delete(id: string) {
    return this.fileModel.findByIdAndDelete(id).exec();
  }
}
