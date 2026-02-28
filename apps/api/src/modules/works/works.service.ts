import { existsSync } from 'fs';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Types } from 'mongoose';
import PDFDocument = require('pdfkit');

import { SearchService } from '../../common/search/search.service';
import {
  ConflictServiceException,
  NotFoundServiceException,
  ValidationServiceException
} from '../../common/errors/service.exception';
import { UnitOfWork } from '../../common/uow/unit-of-work';
import { ClientsService } from '../clients/clients.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { CreateWorkDto } from './dto/create-work.dto';
import { UpdateWorkDto } from './dto/update-work.dto';
import { WorksRepository } from './works.repository';

type PdfFonts = {
  regular: string | null;
  bold: string | null;
};

type WorkLineItem = {
  name: string;
  quantity: number;
  price: number;
  amount: number;
};

type MonthlyClientReportRow = {
  clientId: string;
  clientName: string;
  worksCount: number;
  totalAmount: number;
};

type MonthlyClientReportMonth = {
  monthKey: string;
  monthLabel: string;
  totalWorks: number;
  totalAmount: number;
  clients: MonthlyClientReportRow[];
};

const monthLabelFormatter = new Intl.DateTimeFormat('ru-RU', {
  month: 'long',
  year: 'numeric'
});

@Injectable()
export class WorksService implements OnModuleInit {
  private readonly logger = new Logger(WorksService.name);

  constructor(
    private readonly worksRepository: WorksRepository,
    private readonly organizationsService: OrganizationsService,
    private readonly clientsService: ClientsService,
    private readonly searchService: SearchService,
    private readonly uow: UnitOfWork
  ) {}

  async onModuleInit() {
    await this.worksRepository.backfillYears();
    await this.worksRepository.ensureYearlyNumberIndexes();
    await this.worksRepository.ensureReportingIndexes();
    const rows = await this.worksRepository.findAll();
    for (const row of rows) {
      try {
        await this.indexWork(row);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error';
        this.logger.warn(`Failed to index work ${row._id.toString()} on startup: ${message}`);
      }
    }
  }

  async findAll(query?: string) {
    if (query?.trim()) {
      const ids = await this.searchService.searchWorkIds(query);
      if (!ids.length) {
        return [];
      }

      const rows = await this.worksRepository.findByIds(ids);
      const mapped = new Map(rows.map((row) => [row._id.toString(), row]));
      return ids.map((id) => mapped.get(id)).filter((row) => Boolean(row));
    }

    return this.worksRepository.findAll();
  }

  async getMonthlyClientReport(): Promise<MonthlyClientReportMonth[]> {
    const rows = await this.worksRepository.aggregateMonthlyClientReport();
    const monthMap = new Map<string, MonthlyClientReportMonth>();

    for (const row of rows) {
      const monthKey = `${row.year}-${String(row.month).padStart(2, '0')}`;
      const existingMonth = monthMap.get(monthKey);
      if (existingMonth) {
        existingMonth.totalWorks += row.worksCount;
        existingMonth.totalAmount += row.totalAmount;
        existingMonth.clients.push({
          clientId: row.clientId,
          clientName: row.clientName,
          worksCount: row.worksCount,
          totalAmount: row.totalAmount
        });
        continue;
      }

      monthMap.set(monthKey, {
        monthKey,
        monthLabel: this.toMonthLabel(row.year, row.month),
        totalWorks: row.worksCount,
        totalAmount: row.totalAmount,
        clients: [
          {
            clientId: row.clientId,
            clientName: row.clientName,
            worksCount: row.worksCount,
            totalAmount: row.totalAmount
          }
        ]
      });
    }

    return Array.from(monthMap.values()).map((month) => ({
      ...month,
      clients: month.clients.sort((left, right) => {
        if (left.totalAmount !== right.totalAmount) {
          return right.totalAmount - left.totalAmount;
        }
        if (left.worksCount !== right.worksCount) {
          return right.worksCount - left.worksCount;
        }
        return left.clientName.localeCompare(right.clientName, 'ru-RU');
      })
    }));
  }

  async findById(id: string) {
    const work = await this.worksRepository.findById(id);
    if (!work) {
      throw new NotFoundServiceException('Работа не найдена');
    }
    return work;
  }

  async create(dto: CreateWorkDto) {
    const created = await this.uow.withTransaction(async (session) => {
      const items = this.normalizeItems(dto.items);
      const amount = this.calculateTotal(items);
      const actDate = dto.actDate ? new Date(dto.actDate) : new Date();
      const invoiceDate = dto.invoiceDate ? new Date(dto.invoiceDate) : new Date();
      const actYear = actDate.getFullYear();
      const invoiceYear = invoiceDate.getFullYear();

      const actNumber =
        dto.actNumber ?? String((await this.worksRepository.findMaxActNumberByYear(actYear)) + 1);
      const invoiceNumber =
        dto.invoiceNumber ?? String((await this.worksRepository.findMaxInvoiceNumberByYear(invoiceYear)) + 1);

      const existingAct = await this.worksRepository.findByActNumberInYear(actNumber, actYear);
      if (existingAct) {
        throw new ConflictServiceException('Номер акта уже используется');
      }

      const existingInvoice = await this.worksRepository.findByInvoiceNumberInYear(invoiceNumber, invoiceYear);
      if (existingInvoice) {
        throw new ConflictServiceException('Номер счета уже используется');
      }

      return this.worksRepository.create(
        {
          items,
          amount,
          currency: dto.currency ?? 'RUB',
          executorOrganizationId: new Types.ObjectId(dto.executorOrganizationId),
          clientId: new Types.ObjectId(dto.clientId),
          actNumber,
          invoiceNumber,
          actDate,
          invoiceDate,
          actYear,
          invoiceYear
        },
        session
      );
    });

    await this.indexWork(created);
    return created;
  }

  async update(id: string, dto: UpdateWorkDto) {
    const updated = await this.uow.withTransaction(async (session) => {
      const current = await this.worksRepository.findById(id);
      if (!current) {
        throw new NotFoundServiceException('Работа не найдена');
      }

      const actDate = dto.actDate ? new Date(dto.actDate) : current.actDate;
      const invoiceDate = dto.invoiceDate ? new Date(dto.invoiceDate) : current.invoiceDate;
      const actYear = actDate.getFullYear();
      const invoiceYear = invoiceDate.getFullYear();
      const actNumber = dto.actNumber ?? current.actNumber;
      const invoiceNumber = dto.invoiceNumber ?? current.invoiceNumber;

      const existingAct = await this.worksRepository.findByActNumberInYear(actNumber, actYear);
      if (existingAct && existingAct._id.toString() !== id) {
        throw new ConflictServiceException('Номер акта уже используется');
      }

      const existingInvoice = await this.worksRepository.findByInvoiceNumberInYear(invoiceNumber, invoiceYear);
      if (existingInvoice && existingInvoice._id.toString() !== id) {
        throw new ConflictServiceException('Номер счета уже используется');
      }

      const payload: Record<string, unknown> = { ...dto };
      delete payload.items;
      if (dto.executorOrganizationId) {
        payload.executorOrganizationId = new Types.ObjectId(dto.executorOrganizationId);
      }
      if (dto.clientId) {
        payload.clientId = new Types.ObjectId(dto.clientId);
      }
      if (dto.actDate) {
        payload.actDate = new Date(dto.actDate);
      }
      if (dto.invoiceDate) {
        payload.invoiceDate = new Date(dto.invoiceDate);
      }
      payload.actNumber = actNumber;
      payload.invoiceNumber = invoiceNumber;
      payload.actYear = actYear;
      payload.invoiceYear = invoiceYear;
      if (dto.items) {
        const items = this.normalizeItems(dto.items);
        payload.items = items;
        payload.amount = this.calculateTotal(items);
      }

      const updated = await this.worksRepository.update(id, payload, session);
      if (!updated) {
        throw new NotFoundServiceException('Работа не найдена');
      }
      return updated;
    });

    await this.indexWork(updated);
    return updated;
  }

  async remove(id: string) {
    const removed = await this.uow.withTransaction(async (session) => {
      const removed = await this.worksRepository.delete(id, session);
      if (!removed) {
        throw new NotFoundServiceException('Работа не найдена');
      }
      return removed;
    });

    await this.searchService.deleteWork(id);
    return removed;
  }

  async generateActPdf(id: string) {
    const work = await this.findById(id);
    const { organization, client } = await this.resolveWorkPartiesForDocuments(work);

    return this.buildActPdf(work, organization, client);
  }

  async generateInvoicePdf(id: string) {
    const work = await this.findById(id);
    const { organization, client } = await this.resolveWorkPartiesForDocuments(work);

    return this.buildInvoicePdf(work, organization, client);
  }

  private buildActPdf(work: any, organization: any, client: any): Promise<Buffer> {
    return new Promise((resolve) => {
      const BODY_FONT_SIZE = 10;
      const H2_FONT_SIZE = 16;
      const TABLE_CELL_PADDING = 8;
      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      const chunks: Buffer[] = [];
      const fonts = this.resolvePdfFonts();
      const pageWidth = doc.page.width;
      const left = 42;
      const width = pageWidth - left * 2;

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const title = `Акт выполненных работ (оказанных услуг) № ${work.actNumber} от ${this.formatDate(work.actDate)} г.`;
      this.applyFont(doc, fonts, 'bold');
      let titleFontSize = H2_FONT_SIZE;
      while (titleFontSize > 13) {
        doc.fontSize(titleFontSize);
        if (doc.widthOfString(title) <= width - 4) {
          break;
        }
        titleFontSize -= 0.5;
      }
      doc.fontSize(titleFontSize).text(title, left, 52, { width, align: 'center', lineBreak: false });

      let y = 52 + titleFontSize + 16;
      y = this.drawLabeledParagraph(
        doc,
        fonts,
        left,
        y,
        width,
        'Исполнитель:',
        this.composePartyLine(organization),
        BODY_FONT_SIZE
      );
      y = this.drawLabeledParagraph(
        doc,
        fonts,
        left,
        y + 8,
        width,
        'Заказчик:',
        this.composePartyLine(client),
        BODY_FONT_SIZE
      );
      y = this.drawLabeledParagraph(
        doc,
        fonts,
        left,
        y + 8,
        width,
        'Договор:',
        client.contract?.trim() || '-',
        BODY_FONT_SIZE
      );

      const items = this.normalizeWorkItems(work);
      const totalAmount = this.calculateTotal(items);
      const totalQuantity = this.calculateTotalQuantity(items);

      y += 20;
      const colWidths = [248, 92, 85, 86];
      const headerRowHeight = 34;
      const itemRowHeight = 34;
      const totalsRowHeight = 34;
      const tableX = left;
      let tableY = y;
      const rightPadding = 10;
      const drawRow = (rowY: number, rowHeight: number) => {
        let currentX = tableX;
        for (const colWidth of colWidths) {
          doc.rect(currentX, rowY, colWidth, rowHeight).stroke();
          currentX += colWidth;
        }
      };
      const drawRight = (text: string, x: number, rowY: number, colWidth: number, bold = false) => {
        this.applyFont(doc, fonts, bold ? 'bold' : 'regular');
        doc
          .fontSize(BODY_FONT_SIZE)
          .text(text, x + 4, rowY + TABLE_CELL_PADDING, { width: colWidth - rightPadding, align: 'right' });
      };
      const drawCenter = (text: string, x: number, rowY: number, colWidth: number, bold = false) => {
        this.applyFont(doc, fonts, bold ? 'bold' : 'regular');
        doc
          .fontSize(BODY_FONT_SIZE)
          .text(text, x + 4, rowY + TABLE_CELL_PADDING, { width: colWidth - 8, align: 'center' });
      };

      drawRow(tableY, headerRowHeight);
      drawCenter('Наименование услуги', tableX, tableY, colWidths[0], true);
      drawCenter('Количество', tableX + colWidths[0], tableY, colWidths[1], true);
      drawCenter('Цена', tableX + colWidths[0] + colWidths[1], tableY, colWidths[2], true);
      drawCenter('Сумма', tableX + colWidths[0] + colWidths[1] + colWidths[2], tableY, colWidths[3], true);

      tableY += headerRowHeight;
      for (const item of items) {
        drawRow(tableY, itemRowHeight);
        this.applyFont(doc, fonts, 'regular');
        doc.fontSize(BODY_FONT_SIZE).text(item.name, tableX + 8, tableY + TABLE_CELL_PADDING, {
          width: colWidths[0] - 16,
          align: 'left'
        });
        drawRight(this.formatQuantity(item.quantity), tableX + colWidths[0], tableY, colWidths[1]);
        drawRight(this.formatAmount(item.price), tableX + colWidths[0] + colWidths[1], tableY, colWidths[2]);
        drawRight(this.formatAmount(item.amount), tableX + colWidths[0] + colWidths[1] + colWidths[2], tableY, colWidths[3]);
        tableY += itemRowHeight;
      }

      const mergedWidth = colWidths[0] + colWidths[1] + colWidths[2];
      doc.rect(tableX, tableY, mergedWidth, totalsRowHeight).stroke();
      doc.rect(tableX + mergedWidth, tableY, colWidths[3], totalsRowHeight).stroke();
      drawRight('Итого:', tableX, tableY, mergedWidth, true);
      drawRight(this.formatAmount(totalAmount), tableX + mergedWidth, tableY, colWidths[3]);

      tableY += totalsRowHeight;
      doc.rect(tableX, tableY, mergedWidth, totalsRowHeight).stroke();
      doc.rect(tableX + mergedWidth, tableY, colWidths[3], totalsRowHeight).stroke();
      drawRight('Без налога (НДС):', tableX, tableY, mergedWidth, true);
      drawRight('-', tableX + mergedWidth, tableY, colWidths[3]);

      y = tableY + totalsRowHeight + 20;

      this.applyFont(doc, fonts, 'regular');
      doc
        .fontSize(BODY_FONT_SIZE)
        .text(`Всего оказано услуг: ${this.formatQuantity(totalQuantity)}, на сумму: ${this.formatAmount(totalAmount)} руб.`, left, y, {
          width
        });
      y = doc.y + 2;

      this.applyFont(doc, fonts, 'bold');
      doc.fontSize(BODY_FONT_SIZE).text(`Всего к оплате: ${this.amountToWords(totalAmount)}`, left, y, { width });
      y = doc.y + 8;

      this.applyFont(doc, fonts, 'regular');
      doc
        .fontSize(BODY_FONT_SIZE)
        .text(
          'Вышеперечисленные услуги выполнены полностью и в срок. Заказчик претензий по объему, качеству и срокам оказания услуг не имеет.',
          left,
          y,
          { width }
        );

      y = doc.y + 56;
      const signHeight = 42;
      const halfWidth = width / 2;
      const executorSigner = organization.signerName?.trim() || organization.shortName?.trim() || organization.name;
      const clientSigner = client.signerName?.trim() || client.name;

      doc.rect(left, y, width, signHeight).stroke();
      doc
        .moveTo(left + halfWidth, y)
        .lineTo(left + halfWidth, y + signHeight)
        .stroke();

      this.applyFont(doc, fonts, 'bold');
      doc.fontSize(BODY_FONT_SIZE).text('Исполнитель:', left + 10, y + 8, { width: halfWidth - 20 });
      doc.fontSize(BODY_FONT_SIZE).text('Заказчик:', left + halfWidth + 10, y + 8, { width: halfWidth - 20 });

      this.applyFont(doc, fonts, 'regular');
      doc
        .fontSize(BODY_FONT_SIZE)
        .text(`_____________ ${executorSigner}`, left + 10, y + 22, { width: halfWidth - 20 });
      doc
        .fontSize(BODY_FONT_SIZE)
        .text(`_____________ ${clientSigner}`, left + halfWidth + 10, y + 22, { width: halfWidth - 20 });

      doc.end();
    });
  }

  private buildInvoicePdf(work: any, organization: any, client: any): Promise<Buffer> {
    return new Promise((resolve) => {
      const BODY_FONT_SIZE = 10;
      const H1_FONT_SIZE = 16;
      const H2_FONT_SIZE = 12;
      const TABLE_CELL_PADDING = 8;
      const BANK_FONT_SIZE = 9;
      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      const chunks: Buffer[] = [];
      const fonts = this.resolvePdfFonts();
      const pageWidth = doc.page.width;
      const left = 42;
      const width = pageWidth - left * 2;

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      this.applyFont(doc, fonts, 'bold');
      doc
        .fontSize(H1_FONT_SIZE)
        .text(organization.shortName?.trim() || organization.name, left, 48, { width, align: 'center', lineBreak: false });

      let y = 48 + H1_FONT_SIZE + 8;
      y = this.drawLabeledParagraph(
        doc,
        fonts,
        left,
        y,
        width,
        'Адрес:',
        organization.address?.trim() || '-',
        BODY_FONT_SIZE,
        4
      );

      y += 14;

      const tableX = left;
      const tableY = y;
      const w1 = 128;
      const w2 = 128;
      const w3 = 108;
      const w4 = width - w1 - w2 - w3;
      const rowHeights = [24, 24, 24, 24, 24];
      const totalHeight = rowHeights.reduce((sum, current) => sum + current, 0);

      doc.rect(tableX, tableY, width, totalHeight).stroke();
      doc
        .moveTo(tableX + w2 + w1, tableY)
        .lineTo(tableX + w2 + w1, tableY + totalHeight)
        .stroke();
      doc
        .moveTo(tableX + w2 + w1 + w3, tableY)
        .lineTo(tableX + w2 + w1 + w3, tableY + totalHeight)
        .stroke();
      doc
        .moveTo(tableX + w1, tableY)
        .lineTo(tableX + w1, tableY + rowHeights[0])
        .stroke();

      let currentY = tableY;
      for (const rowHeight of rowHeights.slice(0, -1)) {
        currentY += rowHeight;
        doc
          .moveTo(tableX, currentY)
          .lineTo(tableX + width, currentY)
          .stroke();
      }

      this.applyFont(doc, fonts, 'regular');
      doc
        .fontSize(BANK_FONT_SIZE)
        .text(`ИНН ${organization.inn?.trim() || ''}`, tableX + 6, tableY + 6, { width: w1 - 12 });
      doc
        .fontSize(BANK_FONT_SIZE)
        .text(`КПП ${organization.kpp?.trim() || ''}`, tableX + w1 + 6, tableY + 6, { width: w2 - 12 });

      const y2 = tableY + rowHeights[0];
      doc.fontSize(BANK_FONT_SIZE).text('Получатель', tableX + 6, y2 + 6, { width: w1 + w2 - 12 });
      doc.fontSize(BANK_FONT_SIZE).text('Сч.№', tableX + w1 + w2 + 6, y2 + 6, { width: w3 - 12 });
      doc
        .fontSize(BANK_FONT_SIZE)
        .text(organization.bankAccount?.trim() || '', tableX + w1 + w2 + w3 + 6, y2 + 6, { width: w4 - 12 });

      const y3 = y2 + rowHeights[1];
      doc.fontSize(BANK_FONT_SIZE).text(organization.name, tableX + 6, y3 + 6, { width: w1 + w2 - 12 });

      const y4 = y3 + rowHeights[2];
      doc.fontSize(BANK_FONT_SIZE).text('Банк получателя', tableX + 6, y4 + 6, { width: w1 + w2 - 12 });
      doc.fontSize(BANK_FONT_SIZE).text('БИК', tableX + w1 + w2 + 6, y4 + 6, { width: w3 - 12 });
      doc
        .fontSize(BANK_FONT_SIZE)
        .text(organization.bik?.trim() || '', tableX + w1 + w2 + w3 + 6, y4 + 6, { width: w4 - 12 });

      const y5 = y4 + rowHeights[3];
      doc
        .fontSize(BANK_FONT_SIZE)
        .text(organization.bankName?.trim() || '', tableX + 6, y5 + 6, { width: w1 + w2 - 12 });
      doc.fontSize(BANK_FONT_SIZE).text('Сч.№', tableX + w1 + w2 + 6, y5 + 6, { width: w3 - 12 });
      doc
        .fontSize(BANK_FONT_SIZE)
        .text(organization.correspondentAccount?.trim() || '', tableX + w1 + w2 + w3 + 6, y5 + 6, {
          width: w4 - 12
        });

      y = tableY + totalHeight + 20;
      this.applyFont(doc, fonts, 'bold');
      doc
        .fontSize(H2_FONT_SIZE)
        .text(`Счет № ${work.invoiceNumber} от ${this.formatDate(work.invoiceDate)}`, left, y, {
          width,
          align: 'center',
          lineBreak: false
        });

      y = y + H2_FONT_SIZE + 12;
      this.drawLabeledParagraph(doc, fonts, left, y, width, 'Плательщик:', client.name, BODY_FONT_SIZE);
      y = this.drawLabeledParagraph(
        doc,
        fonts,
        left,
        doc.y + 2,
        width,
        'Адрес:',
        client.address?.trim() || '-',
        BODY_FONT_SIZE
      );
      y = this.drawLabeledParagraph(
        doc,
        fonts,
        left,
        y + 2,
        width,
        'Валюта (наименование, код):',
        'Российский рубль, 643',
        BODY_FONT_SIZE
      );

      const items = this.normalizeWorkItems(work);
      const totalAmount = this.calculateTotal(items);

      y += 12;
      const invoiceCols = [26, 332, width - 26 - 332];
      const headerRowHeight = 30;
      const itemRowHeight = 30;
      const totalsRowHeight = 30;
      const invoiceX = left;
      let invoiceY = y;

      this.drawTableRow(doc, invoiceX, invoiceY, invoiceCols, headerRowHeight);
      this.drawCenteredCellText(doc, fonts, '№', invoiceX, invoiceY, invoiceCols[0], headerRowHeight, true);
      this.drawCenteredCellText(
        doc,
        fonts,
        'Наименование товара/услуги',
        invoiceX + invoiceCols[0],
        invoiceY,
        invoiceCols[1],
        headerRowHeight,
        true
      );
      this.drawCenteredCellText(
        doc,
        fonts,
        'Сумма',
        invoiceX + invoiceCols[0] + invoiceCols[1],
        invoiceY,
        invoiceCols[2],
        headerRowHeight,
        true
      );

      invoiceY += headerRowHeight;
      items.forEach((item, index) => {
        this.drawTableRow(doc, invoiceX, invoiceY, invoiceCols, itemRowHeight);
        this.drawCellText(doc, fonts, String(index + 1), invoiceX, invoiceY + TABLE_CELL_PADDING, invoiceCols[0], 'center');
        this.drawCellText(
          doc,
          fonts,
          item.name,
          invoiceX + invoiceCols[0] + 8,
          invoiceY + TABLE_CELL_PADDING,
          invoiceCols[1] - 16,
          'left'
        );
        this.drawCellText(
          doc,
          fonts,
          this.formatAmount(item.amount),
          invoiceX + invoiceCols[0] + invoiceCols[1] + 4,
          invoiceY + TABLE_CELL_PADDING,
          invoiceCols[2] - 12,
          'right'
        );
        invoiceY += itemRowHeight;
      });

      this.drawInvoiceTotalsRow(
        doc,
        fonts,
        invoiceX,
        invoiceY,
        invoiceCols,
        totalsRowHeight,
        'Итого:',
        this.formatAmount(totalAmount)
      );

      invoiceY += totalsRowHeight;
      this.drawInvoiceTotalsRow(doc, fonts, invoiceX, invoiceY, invoiceCols, totalsRowHeight, 'Итого НДС:', '0,00');

      invoiceY += totalsRowHeight;
      this.drawInvoiceTotalsRow(
        doc,
        fonts,
        invoiceX,
        invoiceY,
        invoiceCols,
        totalsRowHeight,
        'Всего к оплате:',
        this.formatAmount(totalAmount)
      );

      y = invoiceY + totalsRowHeight + 16;
      this.applyFont(doc, fonts, 'regular');
      doc.fontSize(BODY_FONT_SIZE).text(`Всего наименований ${items.length}, на сумму ${this.formatAmount(totalAmount)}`, left, y, {
        width
      });

      y = doc.y + 24;
      const signHeight = 62;
      const halfWidth = width / 2;
      const signer = organization.signerName?.trim() || organization.shortName?.trim() || organization.name;
      const accountant = organization.chiefAccountant?.trim() || '';

      doc.rect(left, y, width, signHeight).stroke();
      doc
        .moveTo(left + halfWidth, y)
        .lineTo(left + halfWidth, y + signHeight)
        .stroke();

      this.applyFont(doc, fonts, 'bold');
      doc.fontSize(BODY_FONT_SIZE).text('Руководитель предприятия', left + 10, y + 10, { width: halfWidth - 20 });
      doc.fontSize(BODY_FONT_SIZE).text('Главный бухгалтер', left + halfWidth + 10, y + 10, { width: halfWidth - 20 });

      this.applyFont(doc, fonts, 'regular');
      doc.fontSize(BODY_FONT_SIZE).text(`_____________ ${signer}`, left + 10, y + 42, { width: halfWidth - 20 });
      doc
        .fontSize(BODY_FONT_SIZE)
        .text(`_____________ ${accountant}`, left + halfWidth + 10, y + 42, { width: halfWidth - 20 });

      doc.end();
    });
  }

  private drawLabeledParagraph(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    x: number,
    y: number,
    width: number,
    label: string,
    value: string,
    fontSize = 12,
    labelGap = 2
  ): number {
    this.applyFont(doc, fonts, 'bold');
    doc.fontSize(fontSize).text(label, x, y, { lineBreak: false });
    const labelWidth = doc.widthOfString(label) + labelGap;
    this.applyFont(doc, fonts, 'regular');
    const valueWidth = Math.max(width - labelWidth, 10);
    doc.fontSize(fontSize).text(value, x + labelWidth, y, { width: valueWidth });
    const lineHeight = doc.heightOfString(value, { width: valueWidth });
    return y + lineHeight;
  }

  private composePartyLine(entity: {
    name: string;
    inn?: string;
    kpp?: string;
    address?: string;
    phone?: string;
  }): string {
    const parts = [entity.name];
    if (entity.inn?.trim()) {
      parts.push(`ИНН ${entity.inn.trim()}`);
    }
    if (entity.kpp?.trim()) {
      parts.push(`КПП ${entity.kpp.trim()}`);
    }
    if (entity.address?.trim()) {
      parts.push(entity.address.trim());
    }
    if (entity.phone?.trim()) {
      parts.push(`тел.: ${entity.phone.trim()}`);
    }
    return parts.join(', ');
  }

  private drawTableRow(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    columnWidths: number[],
    height: number
  ) {
    let currentX = x;
    for (const width of columnWidths) {
      doc.rect(currentX, y, width, height).stroke();
      currentX += width;
    }
  }

  private drawMergedTotalsRow(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    x: number,
    y: number,
    columnWidths: number[],
    height: number,
    label: string,
    value: string
  ) {
    const mergedWidth = columnWidths[0] + columnWidths[1] + columnWidths[2];
    doc.rect(x, y, mergedWidth, height).stroke();
    doc.rect(x + mergedWidth, y, columnWidths[3], height).stroke();

    this.applyFont(doc, fonts, 'bold');
    doc.fontSize(10).text(label, x + 10, y + 8, { width: mergedWidth - 20, align: 'right' });
    this.applyFont(doc, fonts, 'regular');
    doc.fontSize(10).text(value, x + mergedWidth + 6, y + 8, { width: columnWidths[3] - 12, align: 'right' });
  }

  private drawInvoiceTotalsRow(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    x: number,
    y: number,
    columnWidths: number[],
    height: number,
    label: string,
    value: string
  ) {
    const mergedWidth = columnWidths[0] + columnWidths[1];
    doc.rect(x, y, mergedWidth, height).stroke();
    doc.rect(x + mergedWidth, y, columnWidths[2], height).stroke();

    this.applyFont(doc, fonts, 'bold');
    doc.fontSize(10).text(label, x + 8, y + 8, { width: mergedWidth - 16, align: 'right' });
    this.applyFont(doc, fonts, 'regular');
    doc.fontSize(10).text(value, x + mergedWidth + 6, y + 8, { width: columnWidths[2] - 12, align: 'right' });
  }

  private drawCenteredCellText(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    bold = false
  ) {
    this.applyFont(doc, fonts, bold ? 'bold' : 'regular');
    doc.fontSize(10).text(text, x + 6, y + (height - 10) / 2 - 1, {
      width: width - 12,
      align: 'center'
    });
  }

  private drawCellText(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    text: string,
    x: number,
    y: number,
    width: number,
    align: 'left' | 'center' | 'right'
  ) {
    this.applyFont(doc, fonts, 'regular');
    doc.fontSize(10).text(text, x, y, width > 0 ? { width, align } : { align });
  }

  private applyFont(doc: PDFKit.PDFDocument, fonts: PdfFonts, weight: 'regular' | 'bold') {
    if (weight === 'bold') {
      if (fonts.bold) {
        doc.font(fonts.bold);
        return;
      }
      if (fonts.regular) {
        doc.font(fonts.regular);
        return;
      }
      doc.font('Helvetica-Bold');
      return;
    }

    if (fonts.regular) {
      doc.font(fonts.regular);
      return;
    }

    doc.font('Helvetica');
  }

  private resolvePdfFonts(): PdfFonts {
    const configuredRegular = process.env.PDF_FONT_PATH;
    const configuredBold = process.env.PDF_FONT_BOLD_PATH;

    const pairs = [
      [configuredRegular, configuredBold],
      ['/usr/share/fonts/TTF/DejaVuSans.ttf', '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf'],
      ['/usr/share/fonts/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'],
      [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
      ]
    ];

    for (const [regular, bold] of pairs) {
      if (regular && bold && existsSync(regular) && existsSync(bold)) {
        return { regular, bold };
      }
    }

    for (const [regular] of pairs) {
      if (regular && existsSync(regular)) {
        return { regular, bold: null };
      }
    }

    return { regular: null, bold: null };
  }

  private normalizeItems(items: Array<{ name: string; quantity: number; price: number }>): WorkLineItem[] {
    const normalized = (items ?? [])
      .map((item) => {
        const name = item.name?.trim() ?? '';
        const quantity = Number(item.quantity);
        const price = Number(item.price);
        const amount = quantity * price;
        return { name, quantity, price, amount };
      })
      .filter((item) => item.name && item.quantity > 0 && item.price >= 0);

    if (!normalized.length) {
      throw new ValidationServiceException('Добавьте хотя бы одну позицию работы');
    }

    return normalized;
  }

  private normalizeWorkItems(work: any): WorkLineItem[] {
    return this.normalizeItems(
      (work.items ?? []).map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
      }))
    );
  }

  private calculateTotal(items: WorkLineItem[]): number {
    return items.reduce((sum, item) => sum + item.amount, 0);
  }

  private calculateTotalQuantity(items: WorkLineItem[]): number {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }

  private formatDate(value: Date | string): string {
    return new Date(value).toLocaleDateString('ru-RU');
  }

  private formatQuantity(quantity: number): string {
    if (Number.isInteger(quantity)) {
      return String(quantity);
    }

    return quantity.toLocaleString('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3
    });
  }

  private formatAmount(amount: number): string {
    const formatter = new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return formatter.format(amount ?? 0);
  }

  private amountToWords(amount: number): string {
    const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    const totalKopecks = Math.round(safeAmount * 100);
    const rubles = Math.floor(totalKopecks / 100);
    const kopecks = totalKopecks % 100;

    return `${this.numberToWordsRu(rubles)} ${this.pluralize(rubles, ['рубль', 'рубля', 'рублей'])} ${String(
      kopecks
    ).padStart(2, '0')} ${this.pluralize(kopecks, ['копейка', 'копейки', 'копеек'])}`;
  }

  private numberToWordsRu(value: number): string {
    if (value === 0) {
      return 'ноль';
    }

    const units = [
      { forms: ['', '', ''], female: false },
      { forms: ['тысяча', 'тысячи', 'тысяч'], female: true },
      { forms: ['миллион', 'миллиона', 'миллионов'], female: false },
      { forms: ['миллиард', 'миллиарда', 'миллиардов'], female: false }
    ];

    const onesMale = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
    const onesFemale = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
    const teens = [
      'десять',
      'одиннадцать',
      'двенадцать',
      'тринадцать',
      'четырнадцать',
      'пятнадцать',
      'шестнадцать',
      'семнадцать',
      'восемнадцать',
      'девятнадцать'
    ];
    const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
    const hundreds = [
      '',
      'сто',
      'двести',
      'триста',
      'четыреста',
      'пятьсот',
      'шестьсот',
      'семьсот',
      'восемьсот',
      'девятьсот'
    ];

    const parts: string[] = [];
    let rank = 0;
    let current = value;

    while (current > 0) {
      const triad = current % 1000;
      if (triad !== 0) {
        const triadWords: string[] = [];
        const hundredDigit = Math.floor(triad / 100);
        const rest = triad % 100;

        if (hundredDigit > 0) {
          triadWords.push(hundreds[hundredDigit]);
        }

        if (rest >= 10 && rest <= 19) {
          triadWords.push(teens[rest - 10]);
        } else {
          const tenDigit = Math.floor(rest / 10);
          const oneDigit = rest % 10;
          if (tenDigit > 1) {
            triadWords.push(tens[tenDigit]);
          }
          if (oneDigit > 0) {
            triadWords.push(units[rank].female ? onesFemale[oneDigit] : onesMale[oneDigit]);
          }
        }

        if (rank > 0) {
          triadWords.push(this.pluralize(triad, units[rank].forms));
        }

        parts.unshift(triadWords.join(' '));
      }

      current = Math.floor(current / 1000);
      rank += 1;
    }

    return parts.join(' ').trim();
  }

  private pluralize(value: number, forms: [string, string, string] | string[]): string {
    const abs = Math.abs(value) % 100;
    const mod = abs % 10;

    if (abs > 10 && abs < 20) {
      return forms[2];
    }
    if (mod > 1 && mod < 5) {
      return forms[1];
    }
    if (mod === 1) {
      return forms[0];
    }
    return forms[2];
  }

  private async indexWork(work: {
    _id: { toString: () => string };
    items: Array<{ name: string; quantity: number; price: number; amount?: number }>;
    actNumber: string;
    invoiceNumber: string;
    amount: number;
    currency?: string;
    executorOrganizationId: { toString: () => string };
    clientId: { toString: () => string };
  }) {
    const organizationResult = await this.tryFindOrganization(work.executorOrganizationId.toString());
    const clientResult = await this.tryFindClient(work.clientId.toString());

    if (!organizationResult || !clientResult) {
      await this.searchService.deleteWork(work._id.toString());
      this.logger.warn(
        `Skipped indexing work ${work._id.toString()} due to missing related records: ` +
          `organization=${Boolean(organizationResult)} client=${Boolean(clientResult)}`
      );
      return;
    }

    const items = this.normalizeWorkItems(work);
    const itemsText = items
      .map((item) => `${item.name} ${this.formatQuantity(item.quantity)} ${this.formatAmount(item.price)}`)
      .join('; ');
    const totalAmount = this.calculateTotal(items);

    await this.searchService.indexWork({
      id: work._id.toString(),
      items: items.map((item) => item.name),
      itemsText,
      actNumber: work.actNumber,
      invoiceNumber: work.invoiceNumber,
      amount: totalAmount,
      currency: work.currency,
      executorOrganizationId: work.executorOrganizationId.toString(),
      clientId: work.clientId.toString(),
      executorOrganizationName: organizationResult.name,
      clientName: clientResult.name
    });
  }

  private async tryFindOrganization(id: string) {
    try {
      return await this.organizationsService.findById(id);
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  private async tryFindClient(id: string) {
    try {
      return await this.clientsService.findById(id);
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  private isNotFoundError(error: unknown): boolean {
    if (error instanceof NotFoundServiceException) {
      return true;
    }

    if (error && typeof error === 'object') {
      const candidate = error as { code?: unknown; status?: unknown };
      return candidate.code === 'NOT_FOUND' || candidate.status === 404;
    }

    return false;
  }

  private toMonthLabel(year: number, month: number) {
    const label = monthLabelFormatter
      .format(new Date(Date.UTC(year, month - 1, 1)))
      .replace(/\s?г\.$/u, '');
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  private async resolveWorkPartiesForDocuments(work: {
    executorOrganizationId: { toString: () => string };
    clientId: { toString: () => string };
  }) {
    const organization = await this.tryFindOrganization(work.executorOrganizationId.toString());
    const client = await this.tryFindClient(work.clientId.toString());

    if (!organization || !client) {
      throw new ValidationServiceException(
        'У работы отсутствуют актуальные реквизиты организации или клиента. ' +
          'Откройте работу в режиме редактирования и заново выберите организацию/клиента.'
      );
    }

    return { organization, client };
  }
}
