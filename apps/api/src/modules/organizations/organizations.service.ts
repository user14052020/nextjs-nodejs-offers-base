import { Injectable, OnModuleInit } from '@nestjs/common';
import { Types } from 'mongoose';

import { SearchService } from '../../common/search/search.service';
import { NotFoundServiceException } from '../../common/errors/service.exception';
import { UnitOfWork } from '../../common/uow/unit-of-work';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsRepository } from './organizations.repository';

@Injectable()
export class OrganizationsService implements OnModuleInit {
  constructor(
    private readonly organizationsRepository: OrganizationsRepository,
    private readonly searchService: SearchService,
    private readonly uow: UnitOfWork
  ) {}

  async onModuleInit() {
    const rows = await this.organizationsRepository.findAll();
    await Promise.all(
      rows.map((row) =>
        this.searchService.indexOrganization({
          id: row._id.toString(),
          name: row.name,
          shortName: row.shortName,
          inn: row.inn,
          kpp: row.kpp,
          bankName: row.bankName,
          bankAccount: row.bankAccount,
          address: row.address,
          email: row.email,
          phone: row.phone,
          signerName: row.signerName,
          chiefAccountant: row.chiefAccountant
        })
      )
    );
  }

  async findAll(query?: string) {
    if (query?.trim()) {
      const ids = await this.searchService.searchOrganizationIds(query);
      if (!ids.length) {
        return [];
      }

      const rows = await this.organizationsRepository.findByIds(ids);
      const mapped = new Map(rows.map((row) => [row._id.toString(), row]));
      return ids.map((id) => mapped.get(id)).filter((row) => Boolean(row));
    }

    return this.organizationsRepository.findAll();
  }

  async findById(id: string) {
    const organization = await this.organizationsRepository.findById(id);
    if (!organization) {
      throw new NotFoundServiceException('Организация не найдена');
    }
    return organization;
  }

  async create(dto: CreateOrganizationDto) {
    const created = await this.uow.withTransaction(async (session) => {
      return this.organizationsRepository.create(dto, session);
    });

    await this.searchService.indexOrganization({
      id: created._id.toString(),
      name: created.name,
      shortName: created.shortName,
      inn: created.inn,
      kpp: created.kpp,
      bankName: created.bankName,
      bankAccount: created.bankAccount,
      address: created.address,
      email: created.email,
      phone: created.phone,
      signerName: created.signerName,
      chiefAccountant: created.chiefAccountant
    });

    return created;
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    const updated = await this.uow.withTransaction(async (session) => {
      const updated = await this.organizationsRepository.update(id, dto, session);
      if (!updated) {
        throw new NotFoundServiceException('Организация не найдена');
      }
      return updated;
    });

    await this.searchService.indexOrganization({
      id: updated._id.toString(),
      name: updated.name,
      shortName: updated.shortName,
      inn: updated.inn,
      kpp: updated.kpp,
      bankName: updated.bankName,
      bankAccount: updated.bankAccount,
      address: updated.address,
      email: updated.email,
      phone: updated.phone,
      signerName: updated.signerName,
      chiefAccountant: updated.chiefAccountant
    });

    return updated;
  }

  async remove(id: string) {
    const removed = await this.uow.withTransaction(async (session) => {
      const removed = await this.organizationsRepository.delete(id, session);
      if (!removed) {
        throw new NotFoundServiceException('Организация не найдена');
      }
      return removed;
    });

    await this.searchService.deleteOrganization(id);
    return removed;
  }

  async attachFile(id: string, fileId: Types.ObjectId) {
    return this.uow.withTransaction(async (session) => {
      const updated = await this.organizationsRepository.addFile(id, fileId, session);
      if (!updated) {
        throw new NotFoundServiceException('Организация не найдена');
      }
      return updated;
    });
  }

  async detachFile(id: string, fileId: Types.ObjectId) {
    return this.uow.withTransaction(async (session) => {
      const updated = await this.organizationsRepository.removeFile(id, fileId, session);
      if (!updated) {
        throw new NotFoundServiceException('Организация не найдена');
      }
      return updated;
    });
  }
}
