import { existsSync } from 'fs';
import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');

import { Income, IncomePaymentMethod } from './income.schema';

type PdfFonts = {
  regular: string | null;
  bold: string | null;
};

@Injectable()
export class IncomeReceiptPdfService {
  build(income: Income & { _id?: unknown }, organization: any): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      const chunks: Buffer[] = [];
      const fonts = this.resolvePdfFonts();
      const left = 42;
      const width = doc.page.width - left * 2;
      const bodyFontSize = 10;

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const receiptDate = income.receiptDate || income.incomeDate;
      const receiptNumber = income.receiptNumber || String(income._id ?? '');
      const amount = Number(income.grossAmount ?? income.netAmount ?? 0);
      const serviceName = income.orderTitle?.trim() || income.description?.trim() || 'Услуги по разработке ПО';
      const paymentPlace =
        income.settlementPlace?.trim() || organization.address?.trim() || 'дистанционный расчет';

      this.applyFont(doc, fonts, 'bold');
      doc
        .fontSize(16)
        .text(`Квитанция об оплате № ${receiptNumber} от ${this.formatDate(receiptDate)}`, left, 52, {
          width,
          align: 'center'
        });

      this.applyFont(doc, fonts, 'regular');
      let y = 96;
      y = this.drawLine(doc, fonts, left, y, width, 'Дата и время расчета:', this.formatDateTime(income.incomeDate));
      y = this.drawLine(doc, fonts, left, y, width, 'Место расчета:', paymentPlace);
      y = this.drawLine(doc, fonts, left, y, width, 'Признак расчета:', 'приход');
      y = this.drawLine(doc, fonts, left, y, width, 'Система налогообложения:', income.taxRegime || 'ПСН');
      y = this.drawLine(doc, fonts, left, y, width, 'Форма оплаты:', this.paymentMethodLabel(income.paymentMethod));

      y += 10;
      y = this.drawSectionTitle(doc, fonts, left, y, width, 'Исполнитель');
      y = this.drawLine(doc, fonts, left, y, width, 'Наименование:', organization.name || organization.shortName || '-');
      y = this.drawLine(doc, fonts, left, y, width, 'ИНН:', organization.inn || '-');
      y = this.drawLine(doc, fonts, left, y, width, 'Адрес:', organization.address || '-');

      y += 10;
      y = this.drawSectionTitle(doc, fonts, left, y, width, 'Покупатель');
      y = this.drawLine(doc, fonts, left, y, width, 'ФИО / наименование:', income.customerName || '-');

      y += 16;
      const colWidths = [270, 58, 92, 92];
      const tableX = left;
      const headerHeight = 30;
      this.drawTableRow(doc, tableX, y, colWidths, headerHeight);
      this.drawTableCell(doc, fonts, tableX, y, colWidths[0], 'Наименование услуги', true, 'center');
      this.drawTableCell(doc, fonts, tableX + colWidths[0], y, colWidths[1], 'Кол-во', true, 'center');
      this.drawTableCell(doc, fonts, tableX + colWidths[0] + colWidths[1], y, colWidths[2], 'Цена', true, 'center');
      this.drawTableCell(
        doc,
        fonts,
        tableX + colWidths[0] + colWidths[1] + colWidths[2],
        y,
        colWidths[3],
        'Сумма',
        true,
        'center'
      );

      y += headerHeight;
      const itemHeight = Math.max(
        34,
        Math.ceil(this.measureTextHeight(doc, fonts, serviceName, colWidths[0] - 14, bodyFontSize) + 16)
      );
      this.drawTableRow(doc, tableX, y, colWidths, itemHeight);
      this.drawTableCell(doc, fonts, tableX, y, colWidths[0], serviceName, false, 'left');
      this.drawTableCell(doc, fonts, tableX + colWidths[0], y, colWidths[1], '1', false, 'center');
      this.drawTableCell(doc, fonts, tableX + colWidths[0] + colWidths[1], y, colWidths[2], this.formatAmount(amount), false, 'right');
      this.drawTableCell(
        doc,
        fonts,
        tableX + colWidths[0] + colWidths[1] + colWidths[2],
        y,
        colWidths[3],
        this.formatAmount(amount),
        false,
        'right'
      );

      y += itemHeight;
      doc.rect(tableX, y, colWidths[0] + colWidths[1] + colWidths[2], 32).stroke();
      doc.rect(tableX + colWidths[0] + colWidths[1] + colWidths[2], y, colWidths[3], 32).stroke();
      this.drawTableCell(doc, fonts, tableX, y, colWidths[0] + colWidths[1] + colWidths[2], 'Итого:', true, 'right');
      this.drawTableCell(
        doc,
        fonts,
        tableX + colWidths[0] + colWidths[1] + colWidths[2],
        y,
        colWidths[3],
        this.formatAmount(amount),
        true,
        'right'
      );

      y += 48;
      this.applyFont(doc, fonts, 'regular');
      doc.fontSize(bodyFontSize).text(income.cashRegisterExemptionReason || 'ККТ не применяется: ПСН, п. 2.1 ст. 2 54-ФЗ', left, y, {
        width
      });

      y = doc.y + 34;
      const signer = organization.signerName?.trim() || organization.shortName?.trim() || organization.name || '';
      doc.fontSize(bodyFontSize).text(`ИП / представитель: ______________ ${signer}`, left, y, { width });

      doc.end();
    });
  }

  private drawSectionTitle(doc: PDFKit.PDFDocument, fonts: PdfFonts, x: number, y: number, width: number, text: string) {
    this.applyFont(doc, fonts, 'bold');
    doc.fontSize(11).text(text, x, y, { width });
    return doc.y + 6;
  }

  private drawLine(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    x: number,
    y: number,
    width: number,
    label: string,
    value: string
  ) {
    this.applyFont(doc, fonts, 'bold');
    doc.fontSize(10).text(label, x, y, { width: 150, continued: true });
    this.applyFont(doc, fonts, 'regular');
    doc.fontSize(10).text(` ${value}`, { width: width - 150 });
    return doc.y + 4;
  }

  private drawTableRow(doc: PDFKit.PDFDocument, x: number, y: number, colWidths: number[], height: number) {
    let currentX = x;
    for (const colWidth of colWidths) {
      doc.rect(currentX, y, colWidth, height).stroke();
      currentX += colWidth;
    }
  }

  private drawTableCell(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    x: number,
    y: number,
    width: number,
    text: string,
    bold: boolean,
    align: 'left' | 'center' | 'right'
  ) {
    this.applyFont(doc, fonts, bold ? 'bold' : 'regular');
    doc.fontSize(10).text(text, x + 6, y + 8, { width: width - 12, align });
  }

  private measureTextHeight(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    text: string,
    width: number,
    fontSize: number
  ) {
    this.applyFont(doc, fonts, 'regular');
    doc.fontSize(fontSize);
    return doc.heightOfString(text, { width });
  }

  private paymentMethodLabel(method?: IncomePaymentMethod) {
    const labels: Record<IncomePaymentMethod, string> = {
      platform: 'площадка',
      bank_account: 'безналичный расчет на расчетный счет',
      card_transfer: 'безналичный расчет, перевод на карту',
      cash: 'наличными',
      other: 'иной способ оплаты'
    };
    return labels[method || 'other'];
  }

  private formatDate(value: Date | string) {
    return new Date(value).toLocaleDateString('ru-RU');
  }

  private formatDateTime(value: Date | string) {
    return new Date(value).toLocaleString('ru-RU');
  }

  private formatAmount(amount: number) {
    return `${Number(amount || 0).toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} руб.`;
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
      ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']
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
}
