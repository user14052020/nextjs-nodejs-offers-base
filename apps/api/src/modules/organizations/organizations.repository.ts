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
    return this.organizationModel
      .find()
      .populate(OrganizationsRepository.filePopulate.path, OrganizationsRepository.filePopulate.select)
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByIds(ids: string[]) {
    const found = await this.organizationModel
      .find({ _id: { $in: this.idsCandidates(ids) } })
      .populate(OrganizationsRepository.filePopulate.path, OrganizationsRepository.filePopulate.select)
      .exec();

    const foundIds = new Set(found.map((item) => item._id.toString()));
    const missingIds = ids.filter((id) => !foundIds.has(id));
    if (!missingIds.length) {
      return found;
    }

    const raw = await this.organizationModel.collection.find(this.rawIdsInFilter(missingIds)).toArray();
    if (!raw.length) {
      return found;
    }

    const hydrated = raw.map((item) => this.organizationModel.hydrate(item));
    await this.organizationModel.populate(hydrated, OrganizationsRepository.filePopulate);
    return [...found, ...hydrated];
  }

  async findById(id: string) {
    const found = await this.organizationModel
      .findOne({ _id: { $in: this.idCandidates(id) } })
      .populate(OrganizationsRepository.filePopulate.path, OrganizationsRepository.filePopulate.select)
      .exec();

    if (found) {
      return found;
    }

    const raw = await this.organizationModel.collection.findOne(this.rawIdFilter(id));
    if (!raw) {
      return null;
    }

    const hydrated = this.organizationModel.hydrate(raw);
    await this.organizationModel.populate(hydrated, OrganizationsRepository.filePopulate);
    return hydrated;
  }

  async create(payload: Partial<Organization>, session?: ClientSession) {
    const created = new this.organizationModel(payload);
    return created.save({ session });
  }

  async update(id: string, payload: Partial<Organization>, session?: ClientSession) {
    const updated = await this.organizationModel
      .findOneAndUpdate({ _id: { $in: this.idCandidates(id) } }, payload, { new: true, session })
      .populate(OrganizationsRepository.filePopulate.path, OrganizationsRepository.filePopulate.select)
      .exec();
    if (updated) {
      return updated;
    }

    const rawResult = await this.organizationModel.collection.findOneAndUpdate(
      this.rawIdFilter(id),
      { $set: payload },
      { returnDocument: 'after', session }
    );
    const raw = this.unwrapCollectionResult(rawResult);
    if (!raw) {
      return null;
    }

    const hydrated = this.organizationModel.hydrate(raw);
    await this.organizationModel.populate(hydrated, OrganizationsRepository.filePopulate);
    return hydrated;
  }

  async delete(id: string, session?: ClientSession) {
    const removed = await this.organizationModel
      .findOneAndDelete({ _id: { $in: this.idCandidates(id) } }, { session })
      .exec();
    if (removed) {
      return removed;
    }

    const rawResult = await this.organizationModel.collection.findOneAndDelete(this.rawIdFilter(id), { session });
    const raw = this.unwrapCollectionResult(rawResult);
    return raw ? this.organizationModel.hydrate(raw) : null;
  }

  async addFile(id: string, fileId: Types.ObjectId, session?: ClientSession) {
    const updated = await this.organizationModel
      .findOneAndUpdate(
        { _id: { $in: this.idCandidates(id) } },
        { $addToSet: { files: fileId } },
        { new: true, session }
      )
      .populate(OrganizationsRepository.filePopulate.path, OrganizationsRepository.filePopulate.select)
      .exec();
    if (updated) {
      return updated;
    }

    const rawResult = await this.organizationModel.collection.findOneAndUpdate(
      this.rawIdFilter(id),
      { $addToSet: { files: fileId } } as any,
      { returnDocument: 'after', session }
    );
    const raw = this.unwrapCollectionResult(rawResult);
    if (!raw) {
      return null;
    }

    const hydrated = this.organizationModel.hydrate(raw);
    await this.organizationModel.populate(hydrated, OrganizationsRepository.filePopulate);
    return hydrated;
  }

  async removeFile(id: string, fileId: Types.ObjectId, session?: ClientSession) {
    const update = { $pull: { files: { $in: [fileId, fileId.toHexString()] } } };

    const updated = await this.organizationModel
      .findOneAndUpdate(
        { _id: { $in: this.idCandidates(id) } },
        update,
        { new: true, session }
      )
      .populate(OrganizationsRepository.filePopulate.path, OrganizationsRepository.filePopulate.select)
      .exec();
    if (updated) {
      return updated;
    }

    const rawResult = await this.organizationModel.collection.findOneAndUpdate(
      this.rawIdFilter(id),
      update as any,
      { returnDocument: 'after', session }
    );
    const raw = this.unwrapCollectionResult(rawResult);
    if (!raw) {
      return null;
    }

    const hydrated = this.organizationModel.hydrate(raw);
    await this.organizationModel.populate(hydrated, OrganizationsRepository.filePopulate);
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
