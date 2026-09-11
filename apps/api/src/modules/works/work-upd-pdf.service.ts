import { existsSync } from 'fs';
import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');

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

type PartyLike = {
  name?: string;
  shortName?: string;
  inn?: string;
  kpp?: string;
  address?: string;
  phone?: string;
  contract?: string;
  signerName?: string;
  chiefAccountant?: string;
};

type WorkLike = {
  _id?: unknown;
  items?: Array<{ name?: string; quantity?: number; price?: number; amount?: number }>;
  amount?: number;
  currency?: string;
  actNumber?: string;
  invoiceNumber?: string;
  actDate?: Date | string;
  invoiceDate?: Date | string;
};

type TextAlign = 'left' | 'center' | 'right';

type UpdTableColumn = {
  title: string;
  code: string;
  width: number;
  align?: TextAlign;
};

@Injectable()
export class WorkUpdPdfService {
  private readonly page = {
    width: 842,
    height: 595,
    left: 18,
    right: 824,
    top: 18,
    bottom: 548
  };

  private readonly tableColumns: UpdTableColumn[] = [
    { title: 'Код товара/ работ, услуг', code: 'Б', width: 60 },
    { title: '№ п/п', code: '1', width: 20, align: 'center' },
    {
      title: 'Наименование товара (описание выполненных работ, оказанных услуг), имущественного права',
      code: '1а',
      width: 90
    },
    { title: 'Код вида товара', code: '1б', width: 32, align: 'center' },
    { title: 'Единица измерения: код', code: '2', width: 32, align: 'center' },
    { title: 'Единица измерения: условное обозначение', code: '2а', width: 32, align: 'center' },
    { title: 'Количество (объем)', code: '3', width: 33, align: 'right' },
    { title: 'Цена (тариф) за единицу измерения', code: '4', width: 38, align: 'right' },
    { title: 'Стоимость товаров (работ, услуг), имущественных прав без налога - всего', code: '5', width: 38, align: 'right' },
    { title: 'В том числе сумма акциза', code: '6', width: 38, align: 'center' },
    { title: 'Налоговая ставка', code: '7', width: 35, align: 'center' },
    { title: 'Сумма налога, предъявляемая покупателю', code: '8', width: 38, align: 'center' },
    { title: 'Стоимость товаров (работ, услуг), имущественных прав с налогом - всего', code: '9', width: 38, align: 'right' },
    { title: 'Цифровой код страны происхождения товара', code: '10', width: 34, align: 'center' },
    { title: 'Краткое наименование страны происхождения товара', code: '10а', width: 38, align: 'center' },
    { title: 'Номер декларации на товары', code: '11', width: 52, align: 'center' },
    { title: 'Единица прослеживаемости: код', code: '12', width: 34, align: 'center' },
    { title: 'Единица прослеживаемости: условное обозначение', code: '12а', width: 38, align: 'center' },
    { title: 'Количество товара, подлежащего прослеживаемости', code: '13', width: 46, align: 'right' },
    { title: 'Стоимость товара, подлежащего прослеживаемости, без НДС', code: '14', width: 40, align: 'right' }
  ];

  build(work: WorkLike, organization: PartyLike, client: PartyLike): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
      const chunks: Buffer[] = [];
      const fonts = this.resolvePdfFonts();
      const items = this.normalizeWorkItems(work);
      const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      this.preparePage(doc, fonts);
      const tableEnd = this.drawFirstPage(doc, fonts, work, organization, client, items, totalAmount);
      if (tableEnd > this.page.bottom - 8) {
        this.drawPageNumber(doc, fonts, 1);
      }

      doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
      this.preparePage(doc, fonts);
      this.drawTransferPage(doc, fonts, work, organization, client);
      this.drawPageNumber(doc, fonts, 2);

      doc.end();
    });
  }

  private drawFirstPage(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    work: WorkLike,
    organization: PartyLike,
    client: PartyLike,
    items: WorkLineItem[],
    totalAmount: number
  ) {
    this.drawRegulationNote(doc, fonts);
    const tableY = this.drawDocumentHeader(doc, fonts, work, organization, client);
    return this.drawItemsTable(doc, fonts, tableY, items, totalAmount);
  }

  private drawRegulationNote(doc: PDFKit.PDFDocument, fonts: PdfFonts) {
    this.applyFont(doc, fonts, 'regular');
    doc.fontSize(5.4).text(
      'Приложение № 1 к постановлению Правительства Российской Федерации\nот 26 декабря 2011 года № 1137\n(в ред. Постановления Правительства РФ от 23.01.2026 № 26)',
      560,
      18,
      { width: 260, align: 'right', lineGap: 1 }
    );
  }

  private drawDocumentHeader(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    work: WorkLike,
    organization: PartyLike,
    client: PartyLike
  ) {
    const sideX = 18;
    const sideY = 58;
    const sideWidth = 64;
    const statusY = 162;
    const mainX = 92;
    const mainRight = 820;
    const lineWidth = mainRight - mainX;

    doc.rect(sideX, sideY, sideWidth, 184).stroke();
    this.drawTextBox(doc, fonts, 'Универсальный\nпередаточный\nдокумент', sideX + 5, sideY + 16, sideWidth - 10, 48, {
      size: 6.6,
      bold: true,
      align: 'center',
      valign: 'middle'
    });
    this.drawTextBox(doc, fonts, 'Статус:', sideX + 8, statusY - 13, 48, 10, { size: 6.2, bold: true, align: 'center' });
    doc.rect(sideX + 10, statusY, 44, 26).stroke();
    this.drawTextBox(doc, fonts, '2', sideX + 10, statusY + 4, 44, 20, { size: 15, bold: true, align: 'center' });
    this.drawTextBox(
      doc,
      fonts,
      '1 - счет-фактура и передаточный документ\n2 - передаточный документ',
      sideX + 5,
      statusY + 32,
      54,
      38,
      { size: 4.6, align: 'left' }
    );

    this.applyFont(doc, fonts, 'bold');
    doc.fontSize(9).text('Универсальный передаточный документ', mainX, 47, {
      width: lineWidth,
      align: 'center'
    });

    let y = 64;
    const invoiceNumber = this.clean(work.invoiceNumber || work.actNumber) || '-';
    const invoiceDate = this.formatDate(work.invoiceDate || work.actDate);
    const actDate = this.formatDate(work.actDate || work.invoiceDate);
    const sellerName = this.partyName(organization);
    const buyerName = this.partyName(client);

    y = this.drawNumberedLine(
      doc,
      fonts,
      mainX,
      y,
      lineWidth,
      'Счет-фактура №',
      `${invoiceNumber} от ${invoiceDate}`,
      '(1)'
    );
    y = this.drawNumberedLine(doc, fonts, mainX, y, lineWidth, 'Исправление №', '- от -', '(1а)');
    y = this.drawNumberedLine(doc, fonts, mainX, y, lineWidth, 'Продавец', sellerName, '(2)');
    y = this.drawNumberedLine(doc, fonts, mainX, y, lineWidth, 'Адрес', this.clean(organization.address) || '-', '(2а)');
    y = this.drawNumberedLine(doc, fonts, mainX, y, lineWidth, 'ИНН/КПП продавца', this.innKpp(organization), '(2б)');
    y = this.drawNumberedLine(doc, fonts, mainX, y, lineWidth, 'Грузоотправитель и его адрес', 'он же', '(3)');
    y = this.drawNumberedLine(doc, fonts, mainX, y, lineWidth, 'Грузополучатель и его адрес', buyerName, '(4)');
    y = this.drawNumberedLine(doc, fonts, mainX, y, lineWidth, 'К платежно-расчетному документу', '-', '(5)');
    y = this.drawNumberedLine(doc, fonts, mainX, y, lineWidth, 'Документ об отгрузке № п/п', `${invoiceNumber} от ${actDate}`, '(5а)');
    y = this.drawNumberedLine(doc, fonts, mainX, y, lineWidth, 'Покупатель', buyerName, '(6)');
    y = this.drawNumberedLine(doc, fonts, mainX, y, lineWidth, 'Адрес', this.clean(client.address) || '-', '(6а)');
    y = this.drawNumberedLine(doc, fonts, mainX, y, lineWidth, 'ИНН/КПП покупателя', this.innKpp(client), '(6б)');
    y = this.drawNumberedLine(doc, fonts, mainX, y, lineWidth, 'Валюта: наименование, код', 'Российский рубль, 643', '(7)');

    return Math.max(250, y + 4);
  }

  private drawNumberedLine(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    x: number,
    y: number,
    width: number,
    label: string,
    value: string,
    code: string
  ) {
    const labelWidth = 166;
    const codeWidth = 24;
    const valueWidth = width - labelWidth - codeWidth - 6;
    const size = 6.8;
    const contentHeight = Math.max(
      9,
      this.measureText(doc, fonts, value, valueWidth, size, false) + 1
    );

    this.drawTextBox(doc, fonts, label, x, y + 1, labelWidth - 4, contentHeight, {
      size,
      bold: true,
      align: 'left'
    });
    this.drawTextBox(doc, fonts, value, x + labelWidth, y + 1, valueWidth, contentHeight, {
      size,
      align: 'left'
    });
    doc
      .moveTo(x + labelWidth, y + contentHeight + 1)
      .lineTo(x + labelWidth + valueWidth, y + contentHeight + 1)
      .stroke();
    this.drawTextBox(doc, fonts, code, x + width - codeWidth, y + 1, codeWidth, contentHeight, {
      size: 5.8,
      align: 'right'
    });

    return y + contentHeight + 2;
  }

  private drawItemsTable(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    startY: number,
    items: WorkLineItem[],
    totalAmount: number
  ) {
    const headerHeight = 68;
    const codesHeight = 13;
    const minRowHeight = 24;
    const totalRowHeight = 24;
    const tableX = this.page.left;
    const tableWidth = this.tableColumns.reduce((sum, column) => sum + column.width, 0);
    let y = startY;

    const drawHeader = (currentY: number) => {
      let x = tableX;
      for (const column of this.tableColumns) {
        doc.rect(x, currentY, column.width, headerHeight).stroke();
        this.drawTextBox(doc, fonts, column.title, x + 2, currentY + 3, column.width - 4, headerHeight - 6, {
          size: 4.7,
          align: 'center',
          bold: true,
          valign: 'middle'
        });
        doc.rect(x, currentY + headerHeight, column.width, codesHeight).stroke();
        this.drawTextBox(doc, fonts, column.code, x + 1, currentY + headerHeight + 2, column.width - 2, codesHeight - 3, {
          size: 5.3,
          align: 'center',
          bold: true
        });
        x += column.width;
      }
    };

    drawHeader(y);
    y += headerHeight + codesHeight;

    items.forEach((item, index) => {
      const values = this.itemValues(item, index);
      const nameWidth = this.tableColumns[2].width - 5;
      const rowHeight = Math.max(
        minRowHeight,
        Math.ceil(this.measureText(doc, fonts, item.name, nameWidth, 5.4, false) + 8)
      );

      if (y + rowHeight + totalRowHeight > this.page.bottom) {
        this.drawPageNumber(doc, fonts, doc.bufferedPageRange().count);
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
        this.preparePage(doc, fonts);
        this.drawRegulationNote(doc, fonts);
        this.drawTextBox(doc, fonts, 'Продолжение таблицы универсального передаточного документа', tableX, 42, tableWidth, 14, {
          size: 7,
          bold: true,
          align: 'center'
        });
        y = 62;
        drawHeader(y);
        y += headerHeight + codesHeight;
      }

      this.drawTableRow(doc, fonts, tableX, y, rowHeight, values);
      y += rowHeight;
    });

    if (y + totalRowHeight > this.page.bottom) {
      this.drawPageNumber(doc, fonts, doc.bufferedPageRange().count);
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
      this.preparePage(doc, fonts);
      y = 62;
      drawHeader(y);
      y += headerHeight + codesHeight;
    }

    const totalValues = this.tableColumns.map(() => '');
    totalValues[2] = 'Всего к оплате';
    totalValues[8] = this.formatAmount(totalAmount);
    totalValues[11] = 'без НДС';
    totalValues[12] = this.formatAmount(totalAmount);
    this.drawTableRow(doc, fonts, tableX, y, totalRowHeight, totalValues, true);

    return y + totalRowHeight;
  }

  private itemValues(item: WorkLineItem, index: number) {
    return [
      '-',
      String(index + 1),
      item.name,
      '-',
      '796',
      'шт',
      this.formatQuantity(item.quantity),
      this.formatAmount(item.price),
      this.formatAmount(item.amount),
      'без акциза',
      'без НДС',
      'без НДС',
      this.formatAmount(item.amount),
      '-',
      '-',
      '-',
      '-',
      '-',
      '-',
      '-'
    ];
  }

  private drawTableRow(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    tableX: number,
    y: number,
    height: number,
    values: string[],
    bold = false
  ) {
    let x = tableX;
    this.tableColumns.forEach((column, index) => {
      doc.rect(x, y, column.width, height).stroke();
      this.drawTextBox(doc, fonts, values[index] || '', x + 2, y + 3, column.width - 4, height - 6, {
        size: index === 2 ? 5.4 : 5.2,
        align: column.align || 'left',
        bold,
        valign: 'middle'
      });
      x += column.width;
    });
  }

  private drawTransferPage(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    work: WorkLike,
    organization: PartyLike,
    client: PartyLike
  ) {
    this.drawRegulationNote(doc, fonts);
    const left = 28;
    const width = 786;
    const half = width / 2;
    const seller = this.partyName(organization);
    const buyer = this.partyName(client);
    const signer = this.clean(organization.signerName) || seller;
    const accountant = this.clean(organization.chiefAccountant) || signer;
    const buyerSigner = this.clean(client.signerName);
    const transferDate = this.formatDate(work.actDate || work.invoiceDate);
    const basis = this.clean(client.contract) || 'Без документа-основания';

    this.drawTextBox(doc, fonts, 'Сведения о передаче товаров (результатов работ), имущественных прав', left, 48, width, 14, {
      size: 8,
      bold: true,
      align: 'center'
    });

    let y = 78;
    y = this.drawSignatureLine(
      doc,
      fonts,
      left,
      y,
      width,
      'Руководитель организации или иное уполномоченное лицо',
      signer,
      '(8)'
    );
    y = this.drawSignatureLine(doc, fonts, left, y + 6, width, 'Главный бухгалтер или иное уполномоченное лицо', accountant, '(9)');
    y = this.drawSignatureLine(
      doc,
      fonts,
      left,
      y + 6,
      width,
      'Индивидуальный предприниматель или иное уполномоченное лицо',
      signer,
      '(10)'
    );

    y += 12;
    y = this.drawSectionLine(doc, fonts, left, y, width, 'Основание передачи (сдачи) / получения (приемки)', basis, '(11)');
    y = this.drawSectionLine(
      doc,
      fonts,
      left,
      y,
      width,
      'Данные о транспортировке и грузе',
      'Услуги оказаны, груз и транспортировка отсутствуют',
      '(12)'
    );

    y += 8;
    const blockTop = y;
    const blockHeight = 184;
    doc.rect(left, blockTop, width, blockHeight).stroke();
    doc.moveTo(left + half, blockTop).lineTo(left + half, blockTop + blockHeight).stroke();

    this.drawTextBox(doc, fonts, 'Сдал / передал', left + 6, blockTop + 6, half - 12, 12, {
      size: 7,
      bold: true,
      align: 'center'
    });
    this.drawTextBox(doc, fonts, 'Принял / получил', left + half + 6, blockTop + 6, half - 12, 12, {
      size: 7,
      bold: true,
      align: 'center'
    });

    let sellerY = blockTop + 28;
    sellerY = this.drawFieldInBlock(doc, fonts, left + 8, sellerY, half - 16, 'Дата передачи', transferDate, '(13)');
    sellerY = this.drawFieldInBlock(doc, fonts, left + 8, sellerY, half - 16, 'Ответственный за правильность оформления факта хозяйственной жизни', signer, '(14)');
    sellerY = this.drawFieldInBlock(doc, fonts, left + 8, sellerY, half - 16, 'Наименование экономического субъекта - составителя документа', `${seller}, ИНН ${this.clean(organization.inn) || '-'}`, '(15)');
    this.drawSignatureCaption(doc, fonts, left + 8, sellerY + 8, half - 16, signer);

    let buyerY = blockTop + 28;
    buyerY = this.drawFieldInBlock(doc, fonts, left + half + 8, buyerY, half - 16, 'Дата получения', '_______________', '(16)');
    buyerY = this.drawFieldInBlock(
      doc,
      fonts,
      left + half + 8,
      buyerY,
      half - 16,
      'Ответственный за правильность оформления факта хозяйственной жизни',
      buyerSigner || '_______________',
      '(17)'
    );
    buyerY = this.drawFieldInBlock(doc, fonts, left + half + 8, buyerY, half - 16, 'Наименование экономического субъекта', `${buyer}, ИНН ${this.clean(client.inn) || '-'}`, '(18)');
    this.drawSignatureCaption(doc, fonts, left + half + 8, buyerY + 8, half - 16, buyerSigner || '');

    y = blockTop + blockHeight + 18;
    y = this.drawSectionLine(doc, fonts, left, y, width, 'Иные сведения об отгрузке, передаче', 'Услуги оказаны в полном объеме', '(19)');
    y = this.drawSectionLine(doc, fonts, left, y, width, 'Иные сведения о получении, приемке', '', '(20)');
    this.drawSectionLine(
      doc,
      fonts,
      left,
      y,
      width,
      'Наименование оператора электронного документооборота',
      'Печатная форма сформирована в offers-base',
      '(21)'
    );
  }

  private drawSignatureLine(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    x: number,
    y: number,
    width: number,
    label: string,
    value: string,
    code: string
  ) {
    const size = 6.3;
    const labelWidth = 250;
    const lineY = y + 14;
    this.drawTextBox(doc, fonts, label, x, y, labelWidth, 18, { size, bold: true });
    doc.moveTo(x + labelWidth + 4, lineY).lineTo(x + width - 50, lineY).stroke();
    this.drawTextBox(doc, fonts, value, x + labelWidth + 8, y + 1, width - labelWidth - 68, 12, {
      size,
      align: 'center'
    });
    this.drawTextBox(doc, fonts, '/ должность, подпись, расшифровка подписи /', x + labelWidth + 4, lineY + 2, width - labelWidth - 56, 9, {
      size: 4.6,
      align: 'center'
    });
    this.drawTextBox(doc, fonts, code, x + width - 44, y + 4, 40, 10, { size: 5.4, align: 'right' });
    return y + 22;
  }

  private drawSectionLine(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    x: number,
    y: number,
    width: number,
    label: string,
    value: string,
    code: string
  ) {
    const labelWidth = 250;
    const codeWidth = 32;
    const valueWidth = width - labelWidth - codeWidth - 10;
    const size = 6.4;
    const rowHeight = Math.max(18, this.measureText(doc, fonts, value || ' ', valueWidth, size, false) + 8);
    this.drawTextBox(doc, fonts, label, x, y + 2, labelWidth, rowHeight - 4, { size, bold: true });
    doc.moveTo(x + labelWidth + 4, y + rowHeight - 5).lineTo(x + width - codeWidth - 6, y + rowHeight - 5).stroke();
    this.drawTextBox(doc, fonts, value || ' ', x + labelWidth + 8, y + 2, valueWidth, rowHeight - 7, {
      size,
      align: 'left'
    });
    this.drawTextBox(doc, fonts, code, x + width - codeWidth, y + 4, codeWidth, 8, { size: 5.4, align: 'right' });
    return y + rowHeight + 2;
  }

  private drawFieldInBlock(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    x: number,
    y: number,
    width: number,
    label: string,
    value: string,
    code: string
  ) {
    const labelWidth = 168;
    const codeWidth = 24;
    const valueWidth = width - labelWidth - codeWidth - 8;
    const size = 5.9;
    const rowHeight = Math.max(22, this.measureText(doc, fonts, value || ' ', valueWidth, size, false) + 8);
    this.drawTextBox(doc, fonts, label, x, y + 2, labelWidth, rowHeight - 4, { size, bold: true });
    doc.moveTo(x + labelWidth + 2, y + rowHeight - 5).lineTo(x + width - codeWidth - 4, y + rowHeight - 5).stroke();
    this.drawTextBox(doc, fonts, value || ' ', x + labelWidth + 5, y + 2, valueWidth, rowHeight - 7, { size });
    this.drawTextBox(doc, fonts, code, x + width - codeWidth, y + 5, codeWidth, 8, { size: 5.1, align: 'right' });
    return y + rowHeight + 2;
  }

  private drawSignatureCaption(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    x: number,
    y: number,
    width: number,
    signer: string
  ) {
    const lineY = y + 15;
    doc.moveTo(x, lineY).lineTo(x + width, lineY).stroke();
    this.drawTextBox(doc, fonts, signer, x, y, width, 12, { size: 6.2, align: 'center' });
    this.drawTextBox(doc, fonts, '/ подпись, расшифровка подписи /', x, lineY + 2, width, 9, {
      size: 4.8,
      align: 'center'
    });
  }

  private drawTextBox(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    options: {
      size?: number;
      bold?: boolean;
      align?: TextAlign;
      valign?: 'top' | 'middle';
    } = {}
  ) {
    const size = options.size || 6;
    this.applyFont(doc, fonts, options.bold ? 'bold' : 'regular');
    doc.fontSize(size);
    const measured = doc.heightOfString(text, {
      width: Math.max(width, 1),
      align: options.align || 'left',
      lineGap: 0
    });
    const textY = options.valign === 'middle' ? y + Math.max((height - measured) / 2, 0) : y;
    doc.text(text, x, textY, {
      width: Math.max(width, 1),
      height: Math.max(height, 1),
      align: options.align || 'left',
      lineGap: 0
    });
  }

  private drawVerticalText(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    text: string,
    x: number,
    y: number,
    width: number,
    size: number,
    bold = false
  ) {
    doc.save();
    doc.rotate(-90, { origin: [x, y] });
    this.drawTextBox(doc, fonts, text, x - width, y - 1, width, 14, {
      size,
      bold,
      align: 'center'
    });
    doc.restore();
  }

  private drawPageNumber(doc: PDFKit.PDFDocument, fonts: PdfFonts, pageNumber: number) {
    this.drawTextBox(doc, fonts, String(pageNumber), this.page.left, 568, this.page.right - this.page.left, 10, {
      size: 5.8,
      align: 'center'
    });
  }

  private preparePage(doc: PDFKit.PDFDocument, fonts: PdfFonts) {
    this.applyFont(doc, fonts, 'regular');
    doc.lineWidth(0.45).strokeColor('#111111').fillColor('#111111');
  }

  private measureText(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    text: string,
    width: number,
    size: number,
    bold: boolean
  ) {
    this.applyFont(doc, fonts, bold ? 'bold' : 'regular');
    doc.fontSize(size);
    return doc.heightOfString(text || ' ', { width: Math.max(width, 1), lineGap: 0 });
  }

  private normalizeWorkItems(work: WorkLike): WorkLineItem[] {
    const items = (work.items || [])
      .map((item) => {
        const quantity = this.toNumber(item.quantity, 1);
        const price = this.toNumber(item.price, this.toNumber(item.amount, 0));
        const amount = this.toNumber(item.amount, quantity * price);
        return {
          name: this.clean(item.name) || 'Услуги по разработке программного обеспечения',
          quantity,
          price,
          amount
        };
      })
      .filter((item) => item.name && item.quantity > 0);

    if (items.length) {
      return items;
    }

    const amount = this.toNumber(work.amount, 0);
    return [
      {
        name: 'Услуги по разработке программного обеспечения',
        quantity: 1,
        price: amount,
        amount
      }
    ];
  }

  private partyName(party: PartyLike) {
    return this.clean(party.shortName) || this.clean(party.name) || '-';
  }

  private innKpp(party: PartyLike) {
    const inn = this.clean(party.inn);
    const kpp = this.clean(party.kpp);
    if (inn && kpp) {
      return `${inn} / ${kpp}`;
    }
    return inn || kpp || '-';
  }

  private formatDate(value?: Date | string) {
    if (!value) {
      return '-';
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleDateString('ru-RU');
  }

  private formatQuantity(value: number) {
    if (Number.isInteger(value)) {
      return String(value);
    }

    return value.toLocaleString('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3
    });
  }

  private formatAmount(value: number) {
    return Number(value || 0).toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  private toNumber(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private clean(value?: string) {
    return typeof value === 'string' ? value.trim() : '';
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
