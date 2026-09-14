import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';

import { ValidationServiceException } from '../../common/errors/service.exception';
import { ClientsService } from '../clients/clients.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { WorksRepository } from './works.repository';
import { WorksService } from './works.service';

type BalanceReportImportRow = {
  sheetName: string;
  rowNumber: number;
  date: Date;
  description: string;
  customerName?: string;
  orderTitle?: string;
  netAmount: number;
  grossAmount: number;
};

type BalanceReportImportWarning = {
  sheetName: string;
  rowNumber: number;
  message: string;
};

export type BalanceReportImportResult = {
  totalRows: number;
  parsedRows: number;
  importedRows: number;
  skippedDuplicates: number;
  skippedRows: number;
  warnings: BalanceReportImportWarning[];
};

@Injectable()
export class WorkBalanceImportService {
  private static readonly targetSheetNames = ['Операции вне баланса', 'Пополнение баланса'];

  constructor(
    private readonly worksRepository: WorksRepository,
    private readonly worksService: WorksService,
    private readonly organizationsService: OrganizationsService,
    private readonly clientsService: ClientsService
  ) {}

  async importFromBuffer(buffer: Buffer): Promise<BalanceReportImportResult> {
    if (!buffer?.length) {
      throw new ValidationServiceException('Файл импорта пустой');
    }

    const workbook = this.readWorkbook(buffer);
    const parsed = this.parseWorkbook(workbook);
    const defaults = await this.resolveImportDefaults();

    let importedRows = 0;
    let skippedDuplicates = 0;

    for (const row of parsed.rows) {
      if (await this.hasDuplicate(row)) {
        skippedDuplicates += 1;
        continue;
      }

      await this.worksService.create({
        items: [{ name: row.description, quantity: 1, price: row.grossAmount }],
        creditedAmount: row.netAmount,
        isPayed: true,
        currency: 'RUB',
        executorOrganizationId: defaults.organizationId,
        clientId: defaults.clientId,
        actDate: row.date.toISOString(),
        invoiceDate: row.date.toISOString(),
        source: 'kwork',
        sourceName: 'Kwork',
        platformCommission: Math.max(0, row.grossAmount - row.netAmount),
        payoutCommission: 0
      });
      importedRows += 1;
    }

    return {
      totalRows: parsed.totalRows,
      parsedRows: parsed.rows.length,
      importedRows,
      skippedDuplicates,
      skippedRows: parsed.warnings.length,
      warnings: parsed.warnings
    };
  }

  private async resolveImportDefaults() {
    const [organizations, clients] = await Promise.all([
      this.organizationsService.findAll(),
      this.clientsService.findAll()
    ]);
    const organization = organizations[0] as { _id?: { toString: () => string } | string } | undefined;
    const client = clients.find((item) => Boolean((item as { isPhysicalPerson?: boolean }).isPhysicalPerson)) as
      | { _id?: { toString: () => string } | string }
      | undefined;

    if (!organization?._id) {
      throw new ValidationServiceException('Для импорта Kwork нужна хотя бы одна организация');
    }
    if (!client?._id) {
      throw new ValidationServiceException('Для импорта Kwork нужен клиент с признаком "Это физлицо"');
    }

    return {
      organizationId: organization._id.toString(),
      clientId: client._id.toString()
    };
  }

  private readWorkbook(buffer: Buffer) {
    try {
      return XLSX.read(buffer, { type: 'buffer', cellDates: true });
    } catch {
      throw new ValidationServiceException('Не удалось прочитать XLSX файл');
    }
  }

  private parseWorkbook(workbook: XLSX.WorkBook): {
    totalRows: number;
    rows: BalanceReportImportRow[];
    warnings: BalanceReportImportWarning[];
  } {
    const rows: BalanceReportImportRow[] = [];
    const warnings: BalanceReportImportWarning[] = [];
    let totalRows = 0;

    for (const sheetName of WorkBalanceImportService.targetSheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        warnings.push({ sheetName, rowNumber: 0, message: 'Лист не найден' });
        continue;
      }

      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: null,
        raw: false
      });
      if (matrix.length === 0) {
        warnings.push({ sheetName, rowNumber: 0, message: 'Лист пустой' });
        continue;
      }

      const columns = this.mapHeaderColumns(matrix[0]);
      const requiredColumns = ['Дата', 'Описание', 'Сумма', 'Сумма чека самозанятого', 'Статус'];
      const missingColumns = requiredColumns.filter((column) => columns.get(column) === undefined);
      if (missingColumns.length) {
        warnings.push({
          sheetName,
          rowNumber: 1,
          message: `Не найдены колонки: ${missingColumns.join(', ')}`
        });
        continue;
      }

      for (let index = 1; index < matrix.length; index += 1) {
        const sourceRow = matrix[index];
        const rowNumber = index + 1;
        if (this.isEmptyRow(sourceRow) || this.readCell(sourceRow, columns, 'Дата').startsWith('ИТОГО')) {
          continue;
        }

        totalRows += 1;
        const status = this.readCell(sourceRow, columns, 'Статус');
        if (status && status !== 'Выполнено') {
          warnings.push({ sheetName, rowNumber, message: `Строка пропущена: статус "${status}"` });
          continue;
        }

        const parsedRow = this.parseRow(sheetName, rowNumber, sourceRow, columns);
        if (parsedRow.warning) {
          warnings.push(parsedRow.warning);
          continue;
        }
        rows.push(parsedRow.row);
      }
    }

    if (rows.length === 0 && warnings.length === 0) {
      throw new ValidationServiceException('В файле нет строк для импорта');
    }

    return { totalRows, rows, warnings };
  }

  private parseRow(
    sheetName: string,
    rowNumber: number,
    sourceRow: unknown[],
    columns: Map<string, number>
  ): { row: BalanceReportImportRow; warning?: never } | { row?: never; warning: BalanceReportImportWarning } {
    const date = this.parseDate(this.readRawCell(sourceRow, columns, 'Дата'));
    const description = this.readCell(sourceRow, columns, 'Описание');
    const netAmount = this.parseMoney(this.readRawCell(sourceRow, columns, 'Сумма'));
    const grossAmount = this.parseMoney(this.readRawCell(sourceRow, columns, 'Сумма чека самозанятого'));

    if (!date) {
      return { warning: { sheetName, rowNumber, message: 'Некорректная дата' } };
    }
    if (!description) {
      return { warning: { sheetName, rowNumber, message: 'Пустое описание' } };
    }
    if (netAmount === null) {
      return { warning: { sheetName, rowNumber, message: 'Некорректная сумма зачисления' } };
    }
    if (grossAmount === null) {
      return { warning: { sheetName, rowNumber, message: 'Некорректная сумма заказа' } };
    }

    const parsedDescription = this.parseDescription(description);
    return {
      row: {
        sheetName,
        rowNumber,
        date,
        description,
        customerName: parsedDescription.customerName,
        orderTitle: parsedDescription.orderTitle,
        netAmount,
        grossAmount
      }
    };
  }

  private parseDescription(description: string) {
    const match = /^Получение оплаты от покупателя\s+(.+?)\s+за заказ\s+["“”«»]?(.+?)["“”«»]?$/u.exec(description);
    if (!match) {
      return {};
    }

    return {
      customerName: match[1].trim(),
      orderTitle: match[2].trim()
    };
  }

  private async hasDuplicate(row: BalanceReportImportRow): Promise<boolean> {
    const candidates = await this.worksRepository.findDuplicateImportCandidates({
      documentDate: row.date,
      itemName: row.description
    });

    return candidates.some((candidate) => {
      const creditedAmount =
        typeof candidate.creditedAmount === 'number' && Number.isFinite(candidate.creditedAmount)
          ? candidate.creditedAmount
          : candidate.amount;
      const sameDocumentDate = this.sameDate(candidate.actDate, row.date) || this.sameDate(candidate.invoiceDate, row.date);
      return (
        sameDocumentDate &&
        this.sameMoney(Number(candidate.amount), row.grossAmount) &&
        this.sameMoney(Number(creditedAmount), row.netAmount) &&
        candidate.items.some((item) => this.normalizeText(item.name) === this.normalizeText(row.description))
      );
    });
  }

  private mapHeaderColumns(headerRow: unknown[]): Map<string, number> {
    const result = new Map<string, number>();
    headerRow.forEach((value, index) => {
      const header = this.normalizeText(this.stringifyCell(value));
      if (header) {
        result.set(header, index);
      }
    });
    return result;
  }

  private readCell(row: unknown[], columns: Map<string, number>, column: string): string {
    return this.stringifyCell(this.readRawCell(row, columns, column)).trim();
  }

  private readRawCell(row: unknown[], columns: Map<string, number>, column: string): unknown {
    const index = columns.get(column);
    return index === undefined ? null : row[index];
  }

  private isEmptyRow(row: unknown[]): boolean {
    return row.every((cell) => !this.stringifyCell(cell).trim());
  }

  private stringifyCell(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return String(value);
  }

  private parseDate(value: unknown): Date | null {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (!parsed) {
        return null;
      }
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, Math.floor(parsed.S)));
    }

    const text = this.stringifyCell(value).trim();
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(text);
    if (isoMatch) {
      const [, year, month, day, hour = '00', minute = '00', second = '00'] = isoMatch;
      const date = new Date(
        Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))
      );
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const ruMatch = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(text);
    if (!ruMatch) {
      return null;
    }

    const [, day, month, year, hour = '00', minute = '00', second = '00'] = ruMatch;
    const date = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private parseMoney(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value >= 0 ? value : null;
    }

    const normalized = this.stringifyCell(value)
      .replace(/\s/g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, '');
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  private sameDate(left: Date | string, right: Date): boolean {
    const leftDate = new Date(left);
    return (
      leftDate.getUTCFullYear() === right.getUTCFullYear() &&
      leftDate.getUTCMonth() === right.getUTCMonth() &&
      leftDate.getUTCDate() === right.getUTCDate()
    );
  }

  private sameMoney(left: number, right: number): boolean {
    return Math.abs(left - right) < 0.000001;
  }

  private normalizeText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }
}
