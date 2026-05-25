import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';

const ORGANIZATIONS_INDEX = 'organizations';
const CLIENTS_INDEX = 'clients';
const WORKS_INDEX = 'works';

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly client: Client;

  constructor() {
    const node = process.env.ELASTICSEARCH_NODE ?? 'http://elasticsearch:9200';
    this.client = new Client({
      node,
      maxRetries: 1,
      requestTimeout: 5000
    });
  }

  async onModuleInit() {
    try {
      await this.ensureIndices();
    } catch (error) {
      this.logSearchError('ensure indices on startup', error);
    }
  }

  async indexOrganization(document: {
    id: string;
    name: string;
    shortName?: string;
    inn?: string;
    kpp?: string;
    bankName?: string;
    bankAccount?: string;
    address?: string;
    email?: string;
    phone?: string;
    signerName?: string;
    chiefAccountant?: string;
  }) {
    await this.indexDocument(ORGANIZATIONS_INDEX, document.id, document);
  }

  async deleteOrganization(id: string) {
    await this.deleteDocument(ORGANIZATIONS_INDEX, id);
  }

  async searchOrganizationIds(query: string): Promise<string[]> {
    return this.searchIds(ORGANIZATIONS_INDEX, query, [
      'name^4',
      'shortName^3',
      'inn^5',
      'kpp^4',
      'bankName^2',
      'bankAccount^3',
      'address',
      'email',
      'phone',
      'signerName^2',
      'chiefAccountant^2'
    ]);
  }

  async indexClient(document: {
    id: string;
    name: string;
    inn?: string;
    kpp?: string;
    bankName?: string;
    bankAccount?: string;
    address?: string;
    email?: string;
    phone?: string;
    contract?: string;
    signerName?: string;
  }) {
    await this.indexDocument(CLIENTS_INDEX, document.id, document);
  }

  async deleteClient(id: string) {
    await this.deleteDocument(CLIENTS_INDEX, id);
  }

  async searchClientIds(query: string): Promise<string[]> {
    return this.searchIds(CLIENTS_INDEX, query, [
      'name^4',
      'inn^5',
      'kpp^4',
      'bankName^2',
      'bankAccount^3',
      'address',
      'email',
      'phone',
      'contract^3',
      'signerName^2'
    ]);
  }

  async indexWork(document: {
    id: string;
    items?: string[];
    itemsText?: string;
    actNumber: string;
    invoiceNumber: string;
    amount: number;
    currency?: string;
    executorOrganizationId: string;
    clientId: string;
    executorOrganizationName?: string;
    clientName?: string;
  }) {
    await this.indexDocument(WORKS_INDEX, document.id, document);
  }

  async deleteWork(id: string) {
    await this.deleteDocument(WORKS_INDEX, id);
  }

  async searchWorkIds(query: string): Promise<string[]> {
    return this.searchIds(WORKS_INDEX, query, [
      'items^5',
      'itemsText^4',
      'actNumber^5',
      'invoiceNumber^5',
      'executorOrganizationName^2',
      'clientName^2'
    ]);
  }

  async resetIndices() {
    await this.runSafe('reset indices', async () => {
      await Promise.all([
        this.deleteIndexIfExists(ORGANIZATIONS_INDEX),
        this.deleteIndexIfExists(CLIENTS_INDEX),
        this.deleteIndexIfExists(WORKS_INDEX)
      ]);
      await this.ensureIndices();
    });
  }

  private async ensureIndices() {
    await Promise.all([
      this.ensureIndex(ORGANIZATIONS_INDEX),
      this.ensureIndex(CLIENTS_INDEX),
      this.ensureIndex(WORKS_INDEX)
    ]);
  }

  private async ensureIndex(index: string) {
    const existsResult = await this.client.indices.exists({ index });
    const exists =
      typeof existsResult === 'boolean'
        ? existsResult
        : Boolean((existsResult as { body?: boolean }).body);
    if (exists) {
      return;
    }

    await this.client.indices.create({
      index,
      mappings: {
        properties: {
          name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          shortName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          items: { type: 'text' },
          itemsText: { type: 'text' },
          inn: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          kpp: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          bankName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          bankAccount: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          address: { type: 'text' },
          email: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          phone: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          contract: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          signerName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          chiefAccountant: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          actNumber: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          invoiceNumber: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          executorOrganizationName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          clientName: { type: 'text', fields: { keyword: { type: 'keyword' } } }
        }
      }
    });
  }

  private async deleteIndexIfExists(index: string) {
    try {
      await this.client.indices.delete({ index });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('404') || message.includes('index_not_found_exception')) {
        return;
      }
      throw error;
    }
  }

  private async indexDocument(index: string, id: string, document: Record<string, unknown>) {
    await this.runSafe(`index ${index}/${id}`, async () => {
      await this.client.index({
        index,
        id,
        document,
        refresh: 'wait_for'
      });
    });
  }

  private async deleteDocument(index: string, id: string) {
    await this.runSafe(`delete ${index}/${id}`, async () => {
      await this.client.delete({ index, id, refresh: 'wait_for' });
    }, undefined, { ignoreNotFound: true });
  }

  private async searchIds(index: string, query: string, fields: string[]): Promise<string[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    return this.runSafe(
      `search ${index}`,
      async () => {
        const result = await this.client.search({
          index,
          size: 100,
          query: {
            bool: {
              should: [
                {
                  multi_match: {
                    query: trimmed,
                    fields,
                    fuzziness: 'AUTO'
                  }
                },
                {
                  multi_match: {
                    query: trimmed,
                    fields,
                    type: 'phrase_prefix'
                  }
                }
              ],
              minimum_should_match: 1
            }
          }
        });

        const response = (result as { body?: { hits?: { hits?: Array<{ _id: string }> } } }).body ?? (result as any);
        const hits = response.hits?.hits ?? [];
        return hits.map((hit) => String(hit._id));
      },
      []
    );
  }

  private async runSafe<T>(
    operation: string,
    fn: () => Promise<T>,
    fallback?: T,
    options?: { ignoreNotFound?: boolean }
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options?.ignoreNotFound && message.includes('404')) {
        return fallback as T;
      }

      this.logSearchError(operation, error);
      return fallback as T;
    }
  }

  private logSearchError(operation: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Elasticsearch unavailable during "${operation}": ${message}`);
  }
}
