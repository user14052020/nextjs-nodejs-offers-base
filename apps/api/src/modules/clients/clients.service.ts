import { Injectable, OnModuleInit } from '@nestjs/common';
import { Types } from 'mongoose';

import { SearchService } from '../../common/search/search.service';
import { NotFoundServiceException } from '../../common/errors/service.exception';
import { UnitOfWork } from '../../common/uow/unit-of-work';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientsRepository } from './clients.repository';

@Injectable()
export class ClientsService implements OnModuleInit {
  constructor(
    private readonly clientsRepository: ClientsRepository,
    private readonly searchService: SearchService,
    private readonly uow: UnitOfWork
  ) {}

  async onModuleInit() {
    await this.clientsRepository.ensureListingIndexes();
    const rows = await this.clientsRepository.findAll();
    await Promise.all(
      rows.map((row) =>
        this.searchService.indexClient({
          id: row._id.toString(),
          name: row.name,
          inn: row.inn,
          kpp: row.kpp,
          bankName: row.bankName,
          bankAccount: row.bankAccount,
          address: row.address,
          email: row.email,
          phone: row.phone,
          contract: row.contract,
          signerName: row.signerName
        })
      )
    );
  }

  async findAll(query?: string) {
    if (query?.trim()) {
      const ids = await this.searchService.searchClientIds(query);
      if (!ids.length) {
        return [];
      }

      const rows = await this.clientsRepository.findByIds(ids);
      const mapped = new Map(rows.map((row) => [row._id.toString(), row]));
      return ids.map((id) => mapped.get(id)).filter((row) => Boolean(row));
    }

    return this.clientsRepository.findAll();
  }

  async findById(id: string) {
    const client = await this.clientsRepository.findById(id);
    if (!client) {
      throw new NotFoundServiceException('Клиент не найден');
    }
    return client;
  }

  async create(dto: CreateClientDto) {
    const created = await this.uow.withTransaction(async (session) => {
      return this.clientsRepository.create(dto, session);
    });

    await this.searchService.indexClient({
      id: created._id.toString(),
      name: created.name,
      inn: created.inn,
      kpp: created.kpp,
      bankName: created.bankName,
      bankAccount: created.bankAccount,
      address: created.address,
      email: created.email,
      phone: created.phone,
      contract: created.contract,
      signerName: created.signerName
    });

    return created;
  }

  async update(id: string, dto: UpdateClientDto) {
    const updated = await this.uow.withTransaction(async (session) => {
      const updated = await this.clientsRepository.update(id, dto, session);
      if (!updated) {
        throw new NotFoundServiceException('Клиент не найден');
      }
      return updated;
    });

    await this.searchService.indexClient({
      id: updated._id.toString(),
      name: updated.name,
      inn: updated.inn,
      kpp: updated.kpp,
      bankName: updated.bankName,
      bankAccount: updated.bankAccount,
      address: updated.address,
      email: updated.email,
      phone: updated.phone,
      contract: updated.contract,
      signerName: updated.signerName
    });

    return updated;
  }

  async remove(id: string) {
    const removed = await this.uow.withTransaction(async (session) => {
      const removed = await this.clientsRepository.delete(id, session);
      if (!removed) {
        throw new NotFoundServiceException('Клиент не найден');
      }
      return removed;
    });

    await this.searchService.deleteClient(id);
    return removed;
  }

  async attachFile(id: string, fileId: Types.ObjectId) {
    return this.uow.withTransaction(async (session) => {
      const updated = await this.clientsRepository.addFile(id, fileId, session);
      if (!updated) {
        throw new NotFoundServiceException('Клиент не найден');
      }
      return updated;
    });
  }

  async detachFile(id: string, fileId: Types.ObjectId) {
    return this.uow.withTransaction(async (session) => {
      const updated = await this.clientsRepository.removeFile(id, fileId, session);
      if (!updated) {
        throw new NotFoundServiceException('Клиент не найден');
      }
      return updated;
    });
  }
}
