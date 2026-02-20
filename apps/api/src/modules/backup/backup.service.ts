import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Binary, ObjectId } from 'mongodb';
import { once } from 'node:events';
import { PassThrough, Readable } from 'node:stream';
import { createGzip, gunzipSync, Gzip } from 'node:zlib';
import { Connection } from 'mongoose';

import { SearchService } from '../../common/search/search.service';
import { ServiceException, ValidationServiceException } from '../../common/errors/service.exception';

type BackupStream = {
  filename: string;
  stream: Readable;
};

@Injectable()
export class BackupService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly searchService: SearchService
  ) {}

  createBackupStream(): BackupStream {
    const db = this.connection.db;
    if (!db) {
      throw new ServiceException('Нет подключения к MongoDB');
    }

    const gzip = createGzip({ level: 9 });
    const output = new PassThrough();
    gzip.pipe(output);

    void this.writeBackup(gzip, db).catch((error) => {
      gzip.destroy(error instanceof Error ? error : new Error('Не удалось сформировать бэкап'));
    });

    return {
      filename: this.buildFilename(),
      stream: output
    };
  }

  async restoreFromBuffer(raw: Buffer) {
    const db = this.connection.db;
    if (!db) {
      throw new ServiceException('Нет подключения к MongoDB');
    }

    if (!raw || raw.length === 0) {
      throw new ValidationServiceException('Файл бэкапа пустой');
    }

    const text = this.decodeBackup(raw);

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ValidationServiceException('Некорректный JSON бэкапа');
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new ValidationServiceException('Некорректная структура бэкапа');
    }

    const collectionsRaw = (payload as { collections?: unknown }).collections;
    if (!collectionsRaw || typeof collectionsRaw !== 'object' || Array.isArray(collectionsRaw)) {
      throw new ValidationServiceException('В бэкапе отсутствует раздел collections');
    }

    const backupCollections = Object.entries(collectionsRaw as Record<string, unknown>);
    for (const [name, documents] of backupCollections) {
      if (!name.trim()) {
        throw new ValidationServiceException('Найдено пустое имя коллекции в бэкапе');
      }
      if (!Array.isArray(documents)) {
        throw new ValidationServiceException(`Коллекция "${name}" должна быть массивом документов`);
      }
    }

    const existingCollections = (await db.listCollections({}, { nameOnly: true }).toArray())
      .map((collection) => collection.name)
      .filter((name) => !name.startsWith('system.'));

    for (const name of existingCollections) {
      await db.collection(name).deleteMany({});
    }

    let restoredDocuments = 0;
    const restoredByCollection = new Map<string, Record<string, unknown>[]>();
    for (const [name, documents] of backupCollections) {
      const restored = (documents as unknown[])
        .map((document) => this.reviveExtendedJson(document))
        .filter((document): document is Record<string, unknown> => {
          return Boolean(document && typeof document === 'object' && !Array.isArray(document));
        });

      restoredByCollection.set(name, restored);

      if (restored.length > 0) {
        await db.collection(name).insertMany(restored, { ordered: true });
        restoredDocuments += restored.length;
      }
    }

    await this.rebuildSearchIndices(restoredByCollection);

    return {
      message: 'Бэкап восстановлен',
      collections: backupCollections.length,
      documents: restoredDocuments
    };
  }

  private buildFilename() {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const stamp = [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate()),
      '-',
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds())
    ].join('');
    return `offers-base-backup-${stamp}.json.gz`;
  }

  private decodeBackup(raw: Buffer) {
    try {
      if (this.isGzip(raw)) {
        return gunzipSync(raw).toString('utf8');
      }
      return raw.toString('utf8');
    } catch {
      throw new ValidationServiceException('Не удалось распаковать файл бэкапа');
    }
  }

  private isGzip(raw: Buffer) {
    return raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b;
  }

  private async writeBackup(gzip: Gzip, db: NonNullable<Connection['db']>) {
    const collections = (await db.listCollections({}, { nameOnly: true }).toArray())
      .map((collection) => collection.name)
      .filter((name) => !name.startsWith('system.'))
      .sort((left, right) => left.localeCompare(right));

    const meta = {
      createdAt: new Date().toISOString(),
      database: db.databaseName,
      collections
    };

    await this.writeChunk(gzip, '{');
    await this.writeChunk(gzip, `"meta":${JSON.stringify(meta)},"collections":{`);

    for (let index = 0; index < collections.length; index += 1) {
      const name = collections[index];
      await this.writeChunk(gzip, `${index > 0 ? ',' : ''}${JSON.stringify(name)}:[`);

      const cursor = db.collection(name).find({});
      let firstDocument = true;
      for await (const document of cursor) {
        const payload = this.stringifyDocument(document);
        await this.writeChunk(gzip, `${firstDocument ? '' : ','}${payload}`);
        firstDocument = false;
      }

      await this.writeChunk(gzip, ']');
    }

    await this.writeChunk(gzip, '}}');
    gzip.end();
  }

  private async writeChunk(gzip: Gzip, chunk: string) {
    if (!gzip.write(chunk)) {
      await once(gzip, 'drain');
    }
  }

  private stringifyDocument(value: unknown) {
    return JSON.stringify(value, (_key, currentValue) => {
      if (currentValue instanceof Date) {
        return { $date: currentValue.toISOString() };
      }

      if (Buffer.isBuffer(currentValue)) {
        return { $binary: currentValue.toString('base64') };
      }

      if (currentValue && typeof currentValue === 'object') {
        const candidate = currentValue as {
          _bsontype?: string;
          toHexString?: () => string;
          buffer?: Uint8Array;
          sub_type?: number;
        };

        if (candidate._bsontype === 'ObjectId' && typeof candidate.toHexString === 'function') {
          return { $oid: candidate.toHexString() };
        }

        if (candidate._bsontype === 'Binary' && candidate.buffer instanceof Uint8Array) {
          return {
            $binary: Buffer.from(candidate.buffer).toString('base64'),
            $type: String(candidate.sub_type ?? 0)
          };
        }
      }

      return currentValue;
    });
  }

  private reviveExtendedJson(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.reviveExtendedJson(item));
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    const object = value as Record<string, unknown>;

    if (Object.keys(object).length === 1 && typeof object.$oid === 'string') {
      if (!ObjectId.isValid(object.$oid)) {
        return object.$oid;
      }
      return new ObjectId(object.$oid);
    }

    if (Object.keys(object).length === 1 && object.$date) {
      const parsed = new Date(String(object.$date));
      if (Number.isNaN(parsed.getTime())) {
        return object.$date;
      }
      return parsed;
    }

    if (typeof object.$binary === 'string') {
      const type = Number(object.$type ?? 0);
      const subType = Number.isInteger(type) ? type : 0;
      return new Binary(Buffer.from(object.$binary, 'base64'), subType);
    }

    const revived: Record<string, unknown> = {};
    for (const [key, currentValue] of Object.entries(object)) {
      revived[key] = this.reviveExtendedJson(currentValue);
    }
    return revived;
  }

  private async rebuildSearchIndices(restoredByCollection: Map<string, Record<string, unknown>[]>) {
    await this.searchService.resetIndices();

    const organizations = restoredByCollection.get('organizations') ?? [];
    const clients = restoredByCollection.get('clients') ?? [];
    const works = restoredByCollection.get('works') ?? [];

    const organizationNames = new Map<string, string>();
    for (const organization of organizations) {
      const id = this.readId(organization._id);
      if (!id) {
        continue;
      }

      const name = this.readString(organization.name);
      if (name) {
        organizationNames.set(id, name);
      }

      await this.searchService.indexOrganization({
        id,
        name: name || id,
        shortName: this.readString(organization.shortName),
        inn: this.readString(organization.inn),
        kpp: this.readString(organization.kpp),
        bankName: this.readString(organization.bankName),
        bankAccount: this.readString(organization.bankAccount),
        address: this.readString(organization.address),
        email: this.readString(organization.email),
        phone: this.readString(organization.phone),
        signerName: this.readString(organization.signerName),
        chiefAccountant: this.readString(organization.chiefAccountant)
      });
    }

    const clientNames = new Map<string, string>();
    for (const client of clients) {
      const id = this.readId(client._id);
      if (!id) {
        continue;
      }

      const name = this.readString(client.name);
      if (name) {
        clientNames.set(id, name);
      }

      await this.searchService.indexClient({
        id,
        name: name || id,
        inn: this.readString(client.inn),
        kpp: this.readString(client.kpp),
        bankName: this.readString(client.bankName),
        bankAccount: this.readString(client.bankAccount),
        address: this.readString(client.address),
        email: this.readString(client.email),
        phone: this.readString(client.phone),
        contract: this.readString(client.contract),
        signerName: this.readString(client.signerName)
      });
    }

    for (const work of works) {
      const id = this.readId(work._id);
      if (!id) {
        continue;
      }

      const items = this.readItems(work.items);
      const executorOrganizationId = this.readId(work.executorOrganizationId);
      const clientId = this.readId(work.clientId);

      await this.searchService.indexWork({
        id,
        items,
        itemsText: items.join(' '),
        actNumber: this.readString(work.actNumber) || '',
        invoiceNumber: this.readString(work.invoiceNumber) || '',
        amount: this.readNumber(work.amount),
        currency: this.readString(work.currency) || 'RUB',
        executorOrganizationId: executorOrganizationId || '',
        clientId: clientId || '',
        executorOrganizationName: executorOrganizationId
          ? organizationNames.get(executorOrganizationId)
          : undefined,
        clientName: clientId ? clientNames.get(clientId) : undefined
      });
    }
  }

  private readString(value: unknown) {
    return typeof value === 'string' ? value : undefined;
  }

  private readNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private readId(value: unknown) {
    if (!value) {
      return undefined;
    }

    if (typeof value === 'string') {
      return value;
    }

    if (value instanceof ObjectId) {
      return value.toHexString();
    }

    return undefined;
  }

  private readItems(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return undefined;
        }
        return this.readString((item as { name?: unknown }).name);
      })
      .filter((item): item is string => Boolean(item));
  }
}
