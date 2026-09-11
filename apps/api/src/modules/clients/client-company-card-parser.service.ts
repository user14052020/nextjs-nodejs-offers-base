import { Injectable } from '@nestjs/common';
import AdmZip = require('adm-zip');

import { ValidationServiceException } from '../../common/errors/service.exception';
import { CreateClientDto } from './dto/create-client.dto';

type CompanyCardRows = Map<string, string>;

@Injectable()
export class ClientCompanyCardParserService {
  parse(buffer: Buffer): CreateClientDto {
    if (!buffer?.length) {
      throw new ValidationServiceException('Файл реквизитов пустой');
    }

    const xml = this.readDocumentXml(buffer);
    const rows = this.extractRows(xml);
    const client = this.mapRowsToClient(rows);

    if (!client.name?.trim()) {
      throw new ValidationServiceException('Не удалось определить наименование клиента');
    }

    return client;
  }

  private readDocumentXml(buffer: Buffer): string {
    try {
      const zip = new AdmZip(buffer);
      const entry = zip.getEntry('word/document.xml');
      if (!entry) {
        throw new Error('document.xml not found');
      }

      return entry.getData().toString('utf8');
    } catch {
      throw new ValidationServiceException('Не удалось прочитать DOCX файл');
    }
  }

  private extractRows(xml: string): CompanyCardRows {
    const rows = new Map<string, string>();
    const tableRows = [...xml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)];

    for (const rowMatch of tableRows) {
      const cells = [...rowMatch[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)]
        .map((cellMatch) => this.extractText(cellMatch[0]))
        .filter(Boolean);

      if (cells.length >= 2) {
        rows.set(this.normalizeLabel(cells[0]), cells.slice(1).join(' ').trim());
      }
    }

    if (rows.size > 0) {
      return rows;
    }

    const paragraphs = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)]
      .map((paragraphMatch) => this.extractText(paragraphMatch[0]))
      .filter(Boolean);

    for (let index = 0; index < paragraphs.length - 1; index += 2) {
      rows.set(this.normalizeLabel(paragraphs[index]), paragraphs[index + 1]);
    }

    return rows;
  }

  private mapRowsToClient(rows: CompanyCardRows): CreateClientDto {
    const fullName = this.pick(rows, ['полное наименование', 'наименование полное']);
    const shortName = this.pick(rows, ['сокращенное наименование', 'краткое наименование']);
    const normalizedName = this.normalizeCompanyName(shortName, fullName);
    const innKpp = this.pick(rows, ['инн кпп', 'инн/кпп']);
    const inn = this.pick(rows, ['инн']) || innKpp?.split('/')[0]?.trim();
    const kpp = this.pick(rows, ['кпп']) || innKpp?.split('/')[1]?.trim();
    const legalAddress = this.pick(rows, ['юридический адрес', 'юр адрес', 'юр. адрес']);
    const actualAddress = this.pick(rows, [
      'почтовый фактический адрес',
      'почтовый/фактический адрес',
      'фактический адрес',
      'почтовый адрес'
    ]);

    return this.stripEmpty({
      name: normalizedName || fullName || shortName || '',
      isPhysicalPerson: this.isPhysicalPerson(normalizedName || fullName || shortName || '', inn, kpp),
      inn: this.onlyDigits(inn),
      kpp: this.onlyDigits(kpp),
      bankAccount: this.onlyDigits(this.pick(rows, ['р счет', 'р/счет', 'расчетный счет', 'р с', 'р/с'])),
      bankName: this.pick(rows, ['банк', 'наименование банка']),
      bik: this.onlyDigits(this.pick(rows, ['бик'])),
      correspondentAccount: this.onlyDigits(this.pick(rows, ['к счет', 'к/счет', 'корр счет', 'корреспондентский счет', 'к с', 'к/с'])),
      address: legalAddress || actualAddress,
      email: this.pick(rows, ['e mail', 'email', 'электронная почта']),
      phone: this.pick(rows, ['т', 'телефон', 'тел']),
      signerName: this.pick(rows, ['руководитель', 'директор', 'подписант']),
      contract: ''
    });
  }

  private pick(rows: CompanyCardRows, labels: string[]): string | undefined {
    for (const label of labels) {
      const value = rows.get(this.normalizeLabel(label));
      if (value?.trim()) {
        return value.trim();
      }
    }

    return undefined;
  }

  private normalizeCompanyName(shortName?: string, fullName?: string): string | undefined {
    const trimmedShortName = this.cleanText(shortName);
    if (trimmedShortName && this.hasBalancedQuotes(trimmedShortName)) {
      return trimmedShortName;
    }

    const trimmedFullName = this.cleanText(fullName);
    if (!trimmedFullName) {
      return trimmedShortName;
    }

    const legalForms: Array<[RegExp, string]> = [
      [/^общество с ограниченной ответственностью\s+(.+)$/i, 'ООО'],
      [/^акционерное общество\s+(.+)$/i, 'АО'],
      [/^публичное акционерное общество\s+(.+)$/i, 'ПАО'],
      [/^индивидуальный предприниматель\s+(.+)$/i, 'ИП']
    ];

    for (const [pattern, prefix] of legalForms) {
      const match = pattern.exec(trimmedFullName);
      if (match?.[1]) {
        return `${prefix} ${match[1].trim()}`;
      }
    }

    return trimmedShortName || trimmedFullName;
  }

  private hasBalancedQuotes(value: string): boolean {
    return (value.match(/«/g)?.length ?? 0) === (value.match(/»/g)?.length ?? 0);
  }

  private isPhysicalPerson(name: string, inn?: string, kpp?: string) {
    const normalizedName = name.toLowerCase();
    if (/^(ооо|ао|пао|зао|оао|ип)\b/.test(normalizedName)) {
      return false;
    }

    const digitsInn = this.onlyDigits(inn);
    return Boolean(digitsInn && digitsInn.length === 12 && !this.onlyDigits(kpp));
  }

  private extractText(xml: string): string {
    const text = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map((match) => this.decodeXml(match[1]))
      .join('');

    return this.cleanText(text);
  }

  private cleanText(value?: string): string | undefined {
    const cleaned = value?.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    return cleaned || undefined;
  }

  private normalizeLabel(value?: string): string {
    return (this.cleanText(value) || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[.:;№"«»]/g, ' ')
      .replace(/[-_]/g, ' ')
      .replace(/[\\/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private onlyDigits(value?: string): string | undefined {
    const digits = value?.replace(/\D/g, '');
    return digits || undefined;
  }

  private decodeXml(value: string): string {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  private stripEmpty<T extends Record<string, unknown>>(value: T): T {
    return Object.fromEntries(
      Object.entries(value).filter(([, current]) => current !== undefined && current !== '')
    ) as T;
  }
}
