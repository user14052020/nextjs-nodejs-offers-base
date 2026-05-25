import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { File, FileDocument } from './file.schema';

@Injectable()
export class FilesRepository {
  constructor(@InjectModel(File.name) private readonly fileModel: Model<FileDocument>) {}

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

  async create(payload: Partial<File>) {
    const created = new this.fileModel(payload);
    return created.save();
  }

  async findById(id: string) {
    const found = await this.fileModel.findOne({ _id: { $in: this.idCandidates(id) } }).exec();
    if (found) {
      return found;
    }

    const raw = await this.fileModel.collection.findOne(this.rawIdFilter(id));
    return raw ? this.fileModel.hydrate(raw) : null;
  }

  async delete(id: string) {
    const removed = await this.fileModel.findOneAndDelete({ _id: { $in: this.idCandidates(id) } }).exec();
    if (removed) {
      return removed;
    }

    const rawResult = await this.fileModel.collection.findOneAndDelete(this.rawIdFilter(id));
    const raw = this.unwrapCollectionResult(rawResult);
    return raw ? this.fileModel.hydrate(raw) : null;
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
