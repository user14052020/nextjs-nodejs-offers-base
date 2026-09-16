import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Binary, Collection, ObjectId } from 'mongodb';
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

const BACKUP_DATE_FIELDS_BY_COLLECTION: Record<string, string[]> = {
  clients: ['createdAt', 'updatedAt'],
  files: ['createdAt', 'updatedAt'],
  organizations: ['createdAt', 'updatedAt'],
  sequences: ['createdAt', 'updatedAt'],
  users: ['createdAt', 'updatedAt'],
  works: ['actDate', 'invoiceDate', 'createdAt', 'updatedAt'],
  'uploads.files': ['uploadDate']
};

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

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

    const backupCollections = Object.entries(collectionsRaw as Record<string, unknown>).filter(
      ([name]) => !this.isIgnoredCollection(name)
    );
    for (const [name, documents] of backupCollections) {
      if (!name.trim()) {
        throw new ValidationServiceException('Найдено пустое имя коллекции в бэкапе');
      }
      if (!Array.isArray(documents)) {
        throw new ValidationServiceException(`Коллекция "${name}" должна быть массивом документов`);
      }
    }

    let restoredDocuments = 0;
    const idRewrites = this.buildIdRewrites(backupCollections);
    const restoredByCollection = new Map<string, Record<string, unknown>[]>();
    for (const [name, documents] of backupCollections) {
      const restored = (documents as unknown[])
        .map((document) => this.reviveExtendedJson(document))
        .map((document) => this.normalizeDocumentDates(name, document))
        .map((document) => this.normalizeDocumentIds(name, document, idRewrites))
        .map((document) => this.normalizeRestoredDocument(name, document))
        .filter((document): document is Record<string, unknown> => {
          return Boolean(document && typeof document === 'object' && !Array.isArray(document));
        })
        .filter((document) => !this.isIgnoredDocument(name, document));

      restoredByCollection.set(name, restored);
      restoredDocuments += restored.length;
    }

    const existingCollections = (await db.listCollections({}, { nameOnly: true }).toArray())
      .map((collection) => collection.name)
      .filter((name) => !name.startsWith('system.'));

    for (const name of existingCollections) {
      if (this.isIgnoredCollection(name)) {
        await db.collection(name).drop().catch(() => undefined);
        continue;
      }
      await db.collection(name).deleteMany({});
    }

    await this.prepareIndexesForRestore(db);

    for (const [name, restored] of restoredByCollection.entries()) {
      if (restored.length > 0) {
        try {
          await db.collection(name).insertMany(restored, { ordered: true });
        } catch (error) {
          throw new ValidationServiceException(
            `Не удалось восстановить коллекцию "${name}": ${this.errorMessage(error)}`
          );
        }
      }
    }

    this.scheduleSearchRebuild(restoredByCollection);

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
      .filter((name) => !this.isIgnoredCollection(name))
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
        if (this.isIgnoredDocument(name, document)) {
          continue;
        }
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
    return JSON.stringify(this.serializeExtendedJson(value));
  }

  private serializeExtendedJson(value: unknown): unknown {
    if (value instanceof Date) {
      return { $date: value.toISOString() };
    }

    if (Buffer.isBuffer(value)) {
      return { $binary: value.toString('base64') };
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.serializeExtendedJson(item));
    }

    if (value && typeof value === 'object') {
      const candidate = value as {
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

      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, currentValue]) => [
          key,
          this.serializeExtendedJson(currentValue)
        ])
      );
    }

    return value;
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

  private normalizeDocumentDates(collectionName: string, document: unknown): unknown {
    if (!document || typeof document !== 'object' || Array.isArray(document)) {
      return document;
    }

    const dateFields = BACKUP_DATE_FIELDS_BY_COLLECTION[collectionName] ?? [];
    if (!dateFields.length) {
      return document;
    }

    const normalized = { ...(document as Record<string, unknown>) };
    for (const field of dateFields) {
      if (field in normalized) {
        normalized[field] = this.toDateMaybe(normalized[field]);
      }
    }

    return normalized;
  }

  private toDateMaybe(value: unknown): unknown {
    if (value instanceof Date) {
      return value;
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const object = value as Record<string, unknown>;
      if (Object.keys(object).length === 1 && object.$date) {
        const parsed = new Date(String(object.$date));
        return Number.isNaN(parsed.getTime()) ? value : parsed;
      }
    }

    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return value;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? value : parsed;
  }

  private normalizeDocumentIds(
    collectionName: string,
    document: unknown,
    idRewrites: Map<string, ObjectId>
  ): unknown {
    if (!document || typeof document !== 'object' || Array.isArray(document)) {
      return document;
    }

    const normalized = { ...(document as Record<string, unknown>) };

    const normalizeIdField = (field: string) => {
      if (field in normalized) {
        normalized[field] = this.toObjectIdMaybe(normalized[field], true, idRewrites);
      }
    };

    const normalizeIdArrayField = (field: string) => {
      if (!(field in normalized)) {
        return;
      }

      const value = normalized[field];
      if (!Array.isArray(value)) {
        return;
      }

      normalized[field] = value.map((item) => this.toObjectIdMaybe(item, true, idRewrites));
    };

    switch (collectionName) {
      case 'organizations':
      case 'clients':
      case 'works':
      case 'files':
      case 'users':
      case 'uploads.files':
      case 'uploads.chunks':
        normalizeIdField('_id');
        break;
      default:
        break;
    }

    if (collectionName === 'works') {
      normalizeIdField('executorOrganizationId');
      normalizeIdField('clientId');
      normalized.isPayed = typeof normalized.isPayed === 'boolean' ? normalized.isPayed : false;
      normalized.source = normalized.source === 'kwork' ? 'kwork' : 'document';
      normalized.platformCommission =
        typeof normalized.platformCommission === 'number' && Number.isFinite(normalized.platformCommission)
          ? normalized.platformCommission
          : 0;
      normalized.payoutCommission =
        typeof normalized.payoutCommission === 'number' && Number.isFinite(normalized.payoutCommission)
          ? normalized.payoutCommission
          : 0;
    }

    if (collectionName === 'files') {
      normalizeIdField('bucketId');
    }

    if (collectionName === 'uploads.chunks') {
      normalizeIdField('files_id');
    }

    if (collectionName === 'organizations' || collectionName === 'clients') {
      normalizeIdArrayField('files');
    }

    return normalized;
  }

  private async prepareIndexesForRestore(db: NonNullable<Connection['db']>) {
    const works = db.collection('works');
    await this.dropIndexIfExists(works, 'actNumber_1');
    await this.dropIndexIfExists(works, 'invoiceNumber_1');
    await works.createIndex({ actYear: 1, actNumber: 1 }, { unique: true, name: 'actYear_1_actNumber_1' });
    await works.createIndex(
      { invoiceYear: 1, invoiceNumber: 1 },
      { unique: true, name: 'invoiceYear_1_invoiceNumber_1' }
    );
  }

  private async dropIndexIfExists(collection: Collection, indexName: string) {
    const indexes = await collection.indexes().catch(() => []);
    const existing = indexes.find((index) => index.name === indexName);
    if (!existing) {
      return;
    }

    await collection.dropIndex(indexName).catch((error) => {
      const message = this.errorMessage(error);
      if (!message.includes('index not found') && !message.includes('IndexNotFound')) {
        throw error;
      }
    });
  }

  private normalizeRestoredDocument(collectionName: string, document: unknown): unknown {
    if (!document || typeof document !== 'object' || Array.isArray(document)) {
      return document;
    }

    const normalized = { ...(document as Record<string, unknown>) };

    if (collectionName === 'works') {
      const items = this.normalizeWorkItemsForRestore(normalized.items);
      const amount = items.reduce((sum, item) => sum + item.amount, 0);
      const actDate = this.requireDate(normalized.actDate ?? normalized.invoiceDate);
      const invoiceDate = this.requireDate(normalized.invoiceDate ?? actDate);

      normalized.items = items;
      normalized.amount = amount;
      normalized.creditedAmount = this.readFiniteNumber(normalized.creditedAmount, amount);
      normalized.currency = this.readString(normalized.currency) || 'RUB';
      normalized.source = normalized.source === 'kwork' ? 'kwork' : 'document';
      normalized.sourceName =
        this.readString(normalized.sourceName) || (normalized.source === 'kwork' ? 'Kwork' : 'Счет/акт');
      normalized.platformCommission = this.readFiniteNumber(normalized.platformCommission, 0);
      normalized.payoutCommission = this.readFiniteNumber(normalized.payoutCommission, 0);
      normalized.isPayed = typeof normalized.isPayed === 'boolean' ? normalized.isPayed : false;
      normalized.actDate = actDate;
      normalized.invoiceDate = invoiceDate;
      normalized.actYear = this.readYear(normalized.actYear, actDate);
      normalized.invoiceYear = this.readYear(normalized.invoiceYear, invoiceDate);
      normalized.actNumber = this.readString(normalized.actNumber) || '';
      normalized.invoiceNumber = this.readString(normalized.invoiceNumber) || normalized.actNumber;
    }

    if (collectionName === 'clients') {
      normalized.isPhysicalPerson = typeof normalized.isPhysicalPerson === 'boolean' ? normalized.isPhysicalPerson : false;
    }

    if (collectionName === 'uploads.chunks' && 'data' in normalized) {
      normalized.data = this.normalizeGridFsChunkData(normalized.data);
    }

    return normalized;
  }

  private buildIdRewrites(backupCollections: Array<[string, unknown]>) {
    const rewrites = new Map<string, ObjectId>();
    const objectIdCollections = new Set([
      'organizations',
      'clients',
      'works',
      'files',
      'users',
      'uploads.files',
      'uploads.chunks'
    ]);

    for (const [collectionName, documents] of backupCollections) {
      if (!objectIdCollections.has(collectionName) || !Array.isArray(documents)) {
        continue;
      }

      for (const document of documents) {
        if (!document || typeof document !== 'object' || Array.isArray(document)) {
          continue;
        }

        const id = this.readBackupId((document as Record<string, unknown>)._id);
        if (id && !ObjectId.isValid(id) && !rewrites.has(id)) {
          rewrites.set(id, new ObjectId());
        }
      }
    }

    return rewrites;
  }

  private readBackupId(value: unknown): string | undefined {
    if (!value) {
      return undefined;
    }

    if (typeof value === 'string') {
      return value;
    }

    if (value instanceof ObjectId) {
      return value.toHexString();
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const candidate = value as { _id?: unknown; id?: unknown; $oid?: unknown };
      return this.readBackupId(candidate.$oid ?? candidate._id ?? candidate.id);
    }

    return undefined;
  }

  private toObjectIdMaybe(
    value: unknown,
    unwrapNested = false,
    idRewrites: Map<string, ObjectId> = new Map()
  ): unknown {
    if (value instanceof ObjectId) {
      return value;
    }

    const backupId = this.readBackupId(value);
    if (backupId && idRewrites.has(backupId)) {
      return idRewrites.get(backupId);
    }

    if (typeof value === 'string' && ObjectId.isValid(value)) {
      return new ObjectId(value);
    }

    // Legacy backups could carry populated relations like { _id: "<hex>" }.
    if (unwrapNested && value && typeof value === 'object' && !Array.isArray(value)) {
      const candidate = value as { _id?: unknown; id?: unknown; $oid?: unknown };
      if (typeof candidate.$oid === 'string' && ObjectId.isValid(candidate.$oid)) {
        return new ObjectId(candidate.$oid);
      }
      if (typeof candidate._id === 'string' && ObjectId.isValid(candidate._id)) {
        return new ObjectId(candidate._id);
      }
      if (typeof candidate.id === 'string' && ObjectId.isValid(candidate.id)) {
        return new ObjectId(candidate.id);
      }
    }

    return value;
  }

  private normalizeWorkItemsForRestore(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return undefined;
        }

        const record = item as Record<string, unknown>;
        const quantity = this.readFiniteNumber(record.quantity, 1);
        const price = this.readFiniteNumber(record.price, this.readFiniteNumber(record.amount, 0));
        const amount = quantity * price;
        const name = this.readString(record.name)?.trim();
        if (!name || quantity <= 0 || price < 0) {
          return undefined;
        }

        return { name, quantity, price, amount };
      })
      .filter((item): item is { name: string; quantity: number; price: number; amount: number } => Boolean(item));
  }

  private requireDate(value: unknown) {
    const normalized = this.toDateMaybe(value);
    return normalized instanceof Date && !Number.isNaN(normalized.getTime()) ? normalized : new Date();
  }

  private readYear(value: unknown, fallbackDate: Date) {
    return typeof value === 'number' && Number.isInteger(value) ? value : fallbackDate.getFullYear();
  }

  private readFiniteNumber(value: unknown, fallback: number) {
    const number = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  private normalizeGridFsChunkData(value: unknown) {
    if (value instanceof Binary) {
      return value;
    }

    if (Buffer.isBuffer(value)) {
      return new Binary(value);
    }

    if (typeof value === 'string') {
      return new Binary(Buffer.from(value, 'base64'));
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const candidate = value as { type?: unknown; data?: unknown };
      if (candidate.type === 'Buffer' && Array.isArray(candidate.data)) {
        return new Binary(Buffer.from(candidate.data as number[]));
      }
    }

    return value;
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private scheduleSearchRebuild(restoredByCollection: Map<string, Record<string, unknown>[]>) {
    const snapshot = new Map<string, Record<string, unknown>[]>(
      [...restoredByCollection.entries()].map(([collection, documents]): [string, Record<string, unknown>[]] => [
        collection,
        documents.map((document) => ({ ...document }))
      ])
    );

    void this.rebuildSearchIndices(snapshot).catch((error) => {
      this.logger.warn(`Не удалось перестроить поисковый индекс после восстановления: ${this.errorMessage(error)}`);
    });
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
        chiefAccountant: this.readString(organization.chiefAccountant),
        registrationDetails: this.readString(organization.registrationDetails)
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

  private isIgnoredCollection(name: string) {
    return name === 'incomes';
  }

  private isIgnoredDocument(collectionName: string, document: Record<string, unknown>) {
    return collectionName === 'sequences' && this.readString(document.name)?.startsWith('income-receipt-');
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
