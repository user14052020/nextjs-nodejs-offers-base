import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';

import { Client, ClientDocument } from './client.schema';

@Injectable()
export class ClientsRepository {
  constructor(@InjectModel(Client.name) private readonly clientModel: Model<ClientDocument>) {}

  private static readonly filePopulate = {
    path: 'files',
    select: '_id filename mimeType size createdAt'
  } as const;

  // Restored backups can contain legacy string _id values, so raw collection fallback
  // intentionally bypasses ObjectId-only typing.
  private rawIdFilter(id: string) {
    return { _id: id } as any;
  }

  private rawIdsInFilter(ids: string[]) {
    return { _id: { $in: ids } } as any;
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

  async findAll() {
    return this.clientModel
      .find()
      .populate(ClientsRepository.filePopulate.path, ClientsRepository.filePopulate.select)
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByIds(ids: string[]) {
    const found = await this.clientModel
      .find({ _id: { $in: this.idsCandidates(ids) } })
      .populate(ClientsRepository.filePopulate.path, ClientsRepository.filePopulate.select)
      .exec();

    const foundIds = new Set(found.map((item) => item._id.toString()));
    const missingIds = ids.filter((id) => !foundIds.has(id));
    if (!missingIds.length) {
      return found;
    }

    const raw = await this.clientModel.collection.find(this.rawIdsInFilter(missingIds)).toArray();
    if (!raw.length) {
      return found;
    }

    const hydrated = raw.map((item) => this.clientModel.hydrate(item));
    await this.clientModel.populate(hydrated, ClientsRepository.filePopulate);
    return [...found, ...hydrated];
  }

  async findById(id: string) {
    const found = await this.clientModel
      .findOne({ _id: { $in: this.idCandidates(id) } })
      .populate(ClientsRepository.filePopulate.path, ClientsRepository.filePopulate.select)
      .exec();

    if (found) {
      return found;
    }

    const raw = await this.clientModel.collection.findOne(this.rawIdFilter(id));
    if (!raw) {
      return null;
    }

    const hydrated = this.clientModel.hydrate(raw);
    await this.clientModel.populate(hydrated, ClientsRepository.filePopulate);
    return hydrated;
  }

  async create(payload: Partial<Client>, session?: ClientSession) {
    const created = new this.clientModel(payload);
    return created.save({ session });
  }

  async update(id: string, payload: Partial<Client>, session?: ClientSession) {
    const updated = await this.clientModel
      .findOneAndUpdate({ _id: { $in: this.idCandidates(id) } }, payload, { new: true, session })
      .populate(ClientsRepository.filePopulate.path, ClientsRepository.filePopulate.select)
      .exec();
    if (updated) {
      return updated;
    }

    const rawResult = await this.clientModel.collection.findOneAndUpdate(
      this.rawIdFilter(id),
      { $set: payload },
      { returnDocument: 'after', session }
    );
    const raw = this.unwrapCollectionResult(rawResult);
    if (!raw) {
      return null;
    }

    const hydrated = this.clientModel.hydrate(raw);
    await this.clientModel.populate(hydrated, ClientsRepository.filePopulate);
    return hydrated;
  }

  async delete(id: string, session?: ClientSession) {
    const removed = await this.clientModel.findOneAndDelete({ _id: { $in: this.idCandidates(id) } }, { session }).exec();
    if (removed) {
      return removed;
    }

    const rawResult = await this.clientModel.collection.findOneAndDelete(this.rawIdFilter(id), { session });
    const raw = this.unwrapCollectionResult(rawResult);
    return raw ? this.clientModel.hydrate(raw) : null;
  }

  async addFile(id: string, fileId: Types.ObjectId, session?: ClientSession) {
    const updated = await this.clientModel
      .findOneAndUpdate(
        { _id: { $in: this.idCandidates(id) } },
        { $addToSet: { files: fileId } },
        { new: true, session }
      )
      .populate(ClientsRepository.filePopulate.path, ClientsRepository.filePopulate.select)
      .exec();
    if (updated) {
      return updated;
    }

    const rawResult = await this.clientModel.collection.findOneAndUpdate(
      this.rawIdFilter(id),
      { $addToSet: { files: fileId } } as any,
      { returnDocument: 'after', session }
    );
    const raw = this.unwrapCollectionResult(rawResult);
    if (!raw) {
      return null;
    }

    const hydrated = this.clientModel.hydrate(raw);
    await this.clientModel.populate(hydrated, ClientsRepository.filePopulate);
    return hydrated;
  }

  async removeFile(id: string, fileId: Types.ObjectId, session?: ClientSession) {
    const update = { $pull: { files: { $in: [fileId, fileId.toHexString()] } } };

    const updated = await this.clientModel
      .findOneAndUpdate(
        { _id: { $in: this.idCandidates(id) } },
        update,
        { new: true, session }
      )
      .populate(ClientsRepository.filePopulate.path, ClientsRepository.filePopulate.select)
      .exec();
    if (updated) {
      return updated;
    }

    const rawResult = await this.clientModel.collection.findOneAndUpdate(
      this.rawIdFilter(id),
      update as any,
      { returnDocument: 'after', session }
    );
    const raw = this.unwrapCollectionResult(rawResult);
    if (!raw) {
      return null;
    }

    const hydrated = this.clientModel.hydrate(raw);
    await this.clientModel.populate(hydrated, ClientsRepository.filePopulate);
    return hydrated;
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
