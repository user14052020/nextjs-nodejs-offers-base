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
  isPhysicalPerson?: boolean;
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

@Injectable()
export class WorkUpdPdfService {
  private readonly page = {
    width: 842,
    height: 595,
    left: 18,
    right: 823,
    top: 18,
    bottom: 548
  };

  private readonly fnsColumns = [18, 87, 105, 180, 213, 246, 279, 312, 345, 378, 411, 444, 477, 511, 545, 579, 639, 684, 718, 785, 823];

  build(work: WorkLike, organization: PartyLike, client: PartyLike): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, bufferPages: true });
      const chunks: Buffer[] = [];
      const fonts = this.resolvePdfFonts();
      const items = this.normalizeWorkItems(work);
      const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      this.preparePage(doc, fonts);
      this.drawFirstPage(doc, fonts, work, organization, client, items, totalAmount);

      doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
      this.preparePage(doc, fonts);
      this.drawTransferPage(doc, fonts, work, organization, client);

      const pageRange = doc.bufferedPageRange();
      for (let pageIndex = pageRange.start; pageIndex < pageRange.start + pageRange.count; pageIndex += 1) {
        doc.switchToPage(pageIndex);
        this.preparePage(doc, fonts);
        this.drawPageFooter(doc, fonts, work, pageIndex - pageRange.start + 1, pageRange.count);
      }

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
      578,
      42,
      { width: 245, align: 'right', lineGap: 0.6 }
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
    const sideRight = 87;
    const labelX = 96;
    const valueX = 276;
    const codeX = 800;
    const lineRight = 800;
    const invoiceNumber = this.clean(work.invoiceNumber || work.actNumber) || '-';
    const invoiceDate = this.formatDate(work.invoiceDate || work.actDate);
    const actDate = this.formatDate(work.actDate || work.invoiceDate);
    const sellerName = this.partyName(organization);
    const buyerName = this.partyName(client);

    this.drawVerticalRule(doc, sideX, 55.5, 234.75, 0.75);
    this.drawVerticalRule(doc, 85.8, 55.5, 234.75, 1.5);

    this.drawTextBox(doc, fonts, 'Универсальный\nпередаточный\nдокумент', 21, 56, 61, 30, {
      size: 6.1,
      align: 'left'
    });
    this.drawTextBox(doc, fonts, 'Статус', 21, 94, 25, 8, { size: 6.2 });
    this.drawBox(doc, 46.5, 90, 19.5, 15);
    this.drawTextBox(doc, fonts, '2', 47, 90.6, 18.5, 13, { size: 8.2, bold: true, align: 'center' });
    this.drawTextBox(
      doc,
      fonts,
      '1 - счет-фактура\nи передаточный\nдокумент (акт)\n2 - передаточный\nдокумент (акт)\n3 - счет-фактура',
      21,
      114,
      62,
      54,
      { size: 5.2, align: 'left' }
    );

    this.drawInvoiceTopLine(doc, fonts, 'Счет-фактура N', invoiceNumber, invoiceDate, '(1)', 74.5);
    this.drawInvoiceTopLine(doc, fonts, 'Исправление N', '-', '-', '(1а)', 84.25);

    const rows = [
      ['Продавец:', sellerName, '(2)', true],
      ['Адрес:', this.clean(organization.address) || '-', '(2а)', false],
      ['ИНН/КПП продавца:', this.innKpp(organization), '(2б)', false],
      ['Грузоотправитель и его адрес:', 'он же', '(3)', false],
      ['Грузополучатель и его адрес:', '-', '(4)', false],
      ['К платежно-расчетному документу №', '', '(5)', false],
      ['Документ об отгрузке:', '', '(5а)', false],
      ['Покупатель:', buyerName, '(6)', true],
      ['Адрес:', this.clean(client.address) || '-', '(6а)', false],
      ['ИНН/КПП покупателя:', this.innKpp(client), '(6б)', false],
      ['Валюта: наименование, код', 'Российский рубль, 643', '(7)', false],
      ['Идентификатор государственного контракта,\nдоговора (соглашения)(при наличии):', '', '(8)', false]
    ] as Array<[string, string, string, boolean]>;

    const yPositions = [94, 103.75, 113.5, 123.25, 133, 142, 151, 160.75, 170.5, 180.25, 190, 207];
    rows.forEach(([label, value, code, bold], index) => {
      const y = yPositions[index];
      this.drawTextBox(doc, fonts, label, labelX, y - 0.5, valueX - labelX - 4, index === rows.length - 1 ? 17 : 9, {
        size: index === rows.length - 1 ? 5.8 : 6.2,
        bold,
        align: 'left'
      });
      this.drawHorizontalRule(doc, valueX, lineRight, y + (index === rows.length - 1 ? 9 : 8));
      this.drawTextBox(doc, fonts, value, valueX, y - 0.5, lineRight - valueX, 9, { size: 6.2 });
      this.drawTextBox(doc, fonts, code, codeX, y - 0.5, 22, 9, { size: 6.2 });
    });

    return 234.75;
  }

  private drawItemsTable(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    startY: number,
    items: WorkLineItem[],
    totalAmount: number
  ) {
    const columns = this.fnsColumns;
    const headerTop = startY;
    const headerMiddle = 296.25;
    const headerBottom = 370.5;
    const codesBottom = 383.25;
    const minRowHeight = 54;
    const totalRowHeight = 25.5;
    let y = startY;

    const drawHeader = (currentY: number) => {
      const middleY = currentY + (headerMiddle - headerTop);
      const bottomY = currentY + (headerBottom - headerTop);
      const codesY = currentY + (codesBottom - headerTop);

      this.drawHorizontalRule(doc, columns[0], columns[columns.length - 1], currentY, 0.75);
      this.drawHorizontalRule(doc, columns[0], columns[columns.length - 1], bottomY, 0.75);
      this.drawHorizontalRule(doc, columns[0], columns[columns.length - 1], codesY, 0.75);
      this.drawHorizontalRule(doc, columns[4], columns[6], middleY, 0.75);
      this.drawHorizontalRule(doc, columns[13], columns[15], middleY, 0.75);
      this.drawHorizontalRule(doc, columns[16], columns[18], middleY, 0.75);

      columns.forEach((x, index) => {
        this.drawVerticalRule(doc, x, currentY, codesY, index === 1 ? 1.5 : 0.75);
      });

      const headerCells = [
        [0, 1, 'Код товара/\nработ,\nуслуг'],
        [1, 2, '№\nп/п'],
        [2, 3, 'Наименование товара\n(описание выполненных\nработ, оказанных услуг),\nимущественного права'],
        [3, 4, 'Код\nвида\nтовара'],
        [6, 7, 'Количе-\nство\n(объем)'],
        [7, 8, 'Цена\n(тариф)\nза единицу\nизмерения'],
        [8, 9, 'Стоимость товаров\n(работ, услуг),\nимущественных прав\nбез налога - всего'],
        [9, 10, 'В том\nчисле\nсумма\nакциза'],
        [10, 11, 'Налоговая\nставка'],
        [11, 12, 'Сумма налога,\nпредъявляемая\nпокупателю'],
        [12, 13, 'Стоимость товаров\n(работ, услуг),\nимущественных прав\nс налогом - всего'],
        [15, 16, 'Регистрационный\nномер декларации\nна товары или\nрегистрационный\nномер партии\nтовара,\nподлежащего\nпрослеживаемости'],
        [18, 19, 'Количество товара,\nподлежащего\nпрослеживаемости'],
        [19, 20, 'Стоимость товара,\nподлежащего\nпрослеживаемости,\nбез НДС']
      ] as Array<[number, number, string]>;

      headerCells.forEach(([from, to, title]) => {
        this.drawTextBox(doc, fonts, title, columns[from] + 1.5, currentY + 3, columns[to] - columns[from] - 3, bottomY - currentY - 6, {
          size: from === 15 ? 4.25 : 4.8,
          bold: true,
          align: 'center',
          valign: 'middle'
        });
      });

      const groupHeaderCells = [
        [4, 6, 'Единица\nизмерения'],
        [13, 15, 'Страна происхождения\nтовара'],
        [16, 18, 'Единица\nизмерения товара,\nиспользуемая\nв целях\nосуществления\nпрослеживаемости']
      ] as Array<[number, number, string]>;

      groupHeaderCells.forEach(([from, to, title]) => {
        this.drawTextBox(doc, fonts, title, columns[from] + 1.5, currentY + 3, columns[to] - columns[from] - 3, middleY - currentY - 6, {
          size: from === 16 ? 4.35 : 4.8,
          bold: true,
          align: 'center',
          valign: 'middle'
        });
      });

      const subCells = [
        [4, 5, 'код'],
        [5, 6, 'услов-\nное\nобозна-\nчение\n(нацио-\nналь-\nное)'],
        [13, 14, 'цифровой\nкод'],
        [14, 15, 'краткое\nнаиме-\nнование'],
        [16, 17, 'код'],
        [17, 18, 'условное\nобозначение']
      ] as Array<[number, number, string]>;

      subCells.forEach(([from, to, title]) => {
        this.drawTextBox(doc, fonts, title, columns[from] + 1, middleY + 2, columns[to] - columns[from] - 2, bottomY - middleY - 4, {
          size: 4.45,
          bold: true,
          align: 'center',
          valign: 'middle'
        });
      });

      const codes = ['Б', '1', '1а', '1б', '2', '2а', '3', '4', '5', '6', '7', '8', '9', '10', '10а', '11', '12', '12а', '13', '14'];
      codes.forEach((code, index) => {
        this.drawTextBox(doc, fonts, code, columns[index] + 1, bottomY + 2, columns[index + 1] - columns[index] - 2, codesY - bottomY - 3, {
          size: 5.2,
          bold: true,
          align: 'center'
        });
      });
    };

    drawHeader(y);
    y += codesBottom - headerTop;

    items.forEach((item, index) => {
      const values = this.itemValues(item, index);
      const nameWidth = columns[3] - columns[2] - 5;
      const rowHeight = Math.max(
        minRowHeight,
        Math.ceil(this.measureText(doc, fonts, item.name, nameWidth, 5.6, false) + 14)
      );

      if (y + rowHeight + totalRowHeight > this.page.bottom) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
        this.preparePage(doc, fonts);
        this.drawRegulationNote(doc, fonts);
        this.drawTextBox(doc, fonts, 'Продолжение таблицы универсального передаточного документа', columns[0], 42, columns[columns.length - 1] - columns[0], 14, {
          size: 7,
          bold: true,
          align: 'center'
        });
        y = 62;
        drawHeader(y);
        y += codesBottom - headerTop;
      }

      this.drawTableRow(doc, fonts, y, rowHeight, values);
      y += rowHeight;
    });

    if (y + totalRowHeight > this.page.bottom) {
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
      this.preparePage(doc, fonts);
      y = 62;
      drawHeader(y);
      y += codesBottom - headerTop;
    }

    this.drawFnsTotalRow(doc, fonts, y, totalRowHeight, totalAmount);

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
    y: number,
    height: number,
    values: string[],
    bold = false
  ) {
    const columns = this.fnsColumns;
    columns.slice(0, -1).forEach((x, index) => {
      const width = columns[index + 1] - x;
      doc.rect(x, y, width, height).stroke();
      const align = this.fnsColumnAlign(index);
      this.drawTextBox(doc, fonts, values[index] || '', x + 2, y + 3, width - 4, height - 6, {
        size: index === 2 ? 5.6 : 5,
        align,
        bold,
        valign: 'middle'
      });
    });
  }

  private drawFnsTotalRow(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    y: number,
    height: number,
    totalAmount: number
  ) {
    const columns = this.fnsColumns;

    this.drawHorizontalRule(doc, columns[0], columns[columns.length - 1], y, 0.75);
    this.drawHorizontalRule(doc, columns[0], columns[13], y + height, 0.75);
    this.drawVerticalRule(doc, columns[0], y, y + height, 0.75);
    this.drawVerticalRule(doc, columns[1], y, y + height, 1.5);
    this.drawVerticalRule(doc, columns[8], y, y + height, 0.75);
    this.drawVerticalRule(doc, columns[9], y, y + height, 0.75);
    this.drawVerticalRule(doc, columns[10], y, y + height, 0.75);
    this.drawVerticalRule(doc, columns[11], y, y + height, 0.75);
    this.drawVerticalRule(doc, columns[12], y, y + height, 0.75);
    this.drawVerticalRule(doc, columns[13], y, y + height, 0.75);

    this.drawTextBox(doc, fonts, 'Всего к оплате (9)', columns[1] + 2, y + 3, columns[8] - columns[1] - 4, height - 6, {
      size: 5.3,
      bold: true,
      align: 'center',
      valign: 'middle'
    });
    this.drawTextBox(doc, fonts, this.formatAmount(totalAmount), columns[8] + 2, y + 3, columns[9] - columns[8] - 4, height - 6, {
      size: 5,
      bold: true,
      align: 'right',
      valign: 'middle'
    });
    this.drawTextBox(doc, fonts, 'Х', columns[9] + 1, y + 3, columns[10] - columns[9] - 2, height - 6, {
      size: 5,
      align: 'center',
      valign: 'middle'
    });
    this.drawTextBox(doc, fonts, 'Х', columns[10] + 1, y + 3, columns[11] - columns[10] - 2, height - 6, {
      size: 5,
      align: 'center',
      valign: 'middle'
    });
    this.drawTextBox(doc, fonts, 'без\nНДС', columns[11] + 1, y + 3, columns[12] - columns[11] - 2, height - 6, {
      size: 5,
      bold: true,
      align: 'center',
      valign: 'middle'
    });
    this.drawTextBox(doc, fonts, this.formatAmount(totalAmount), columns[12] + 2, y + 3, columns[13] - columns[12] - 4, height - 6, {
      size: 5,
      bold: true,
      align: 'right',
      valign: 'middle'
    });
  }

  private fnsColumnAlign(index: number): TextAlign {
    if ([1, 3, 4, 5, 9, 10, 11, 13, 14, 15, 16, 17].includes(index)) {
      return 'center';
    }

    if ([6, 7, 8, 12, 18, 19].includes(index)) {
      return 'right';
    }

    return 'left';
  }

  private drawTransferPage(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    work: WorkLike,
    organization: PartyLike,
    client: PartyLike
  ) {
    const seller = this.partyName(organization);
    const buyer = this.partyName(client);
    const signer = this.personShortName(organization.signerName) || this.personShortName(organization.name) || seller;
    const isSellerIp = /^(ИП\s|Индивидуальный предприниматель)/iu.test(seller);
    const chiefAccountant = this.clean(organization.chiefAccountant);
    const managerSigner = isSellerIp ? '' : signer;
    const buyerSigner = this.personShortName(client.signerName) || (client.isPhysicalPerson ? this.personShortName(client.name) : '');
    const basis =
      this.clean(client.contract) ||
      'Без документа-основания отгрузки товаров (передачи результатов работ), передачи имущественных прав (предъявления оказанных услуг)';
    const [day, month, year] = this.formatUpdDateParts(work.actDate || work.invoiceDate);

    this.drawVerticalRule(doc, 85.8, 0, 75.8, 1.5);
    this.drawHorizontalRule(doc, 85.8, this.page.right, 75.8, 1.5);

    this.drawTextBox(doc, fonts, 'Руководитель организации\nили иное уполномоченное лицо', 96, 17.8, 136, 17, {
      size: 5.8,
      bold: true
    });
    this.drawHorizontalRule(doc, 238.5, 390.8, 36);
    this.drawHorizontalRule(doc, 390.8, 598.5, 36);
    this.drawTextBox(doc, fonts, managerSigner, 392, 21.5, 205, 13, { size: 6.1, align: 'center' });
    this.drawTextBox(doc, fonts, '(подпись)', 238.5, 38.5, 152.3, 8, { size: 4.4, align: 'center' });
    this.drawTextBox(doc, fonts, '(ф.и.о.)', 390.8, 38.5, 207.7, 8, { size: 4.4, align: 'center' });

    this.drawTextBox(doc, fonts, 'Главный бухгалтер\nили иное уполномоченное лицо', 608, 17.8, 122, 17, {
      size: 5.8,
      bold: true
    });
    this.drawHorizontalRule(doc, 733.5, 782.2, 36);
    this.drawHorizontalRule(doc, 782.2, 823, 36);
    this.drawTextBox(doc, fonts, chiefAccountant, 733.5, 21.5, 89.5, 13, { size: 5.7, align: 'center' });
    this.drawTextBox(doc, fonts, '(подпись)', 733.5, 38.5, 48.7, 8, { size: 4.4, align: 'center' });
    this.drawTextBox(doc, fonts, '(ф.и.о.)', 782.2, 38.5, 40.8, 8, { size: 4.4, align: 'center' });

    this.drawTextBox(doc, fonts, 'Индивидуальный предприниматель\nили иное уполномоченное лицо', 96, 51, 136, 17, {
      size: 5.8,
      bold: true
    });
    this.drawHorizontalRule(doc, 238.5, 390.8, 61.5);
    this.drawHorizontalRule(doc, 390.8, 598.5, 61.5);
    this.drawHorizontalRule(doc, 598.5, 823, 61.5);
    this.drawTextBox(doc, fonts, signer, 392, 47, 205, 13, { size: 6.1, align: 'center' });
    this.drawTextBox(doc, fonts, '(подпись)', 238.5, 64, 152.3, 8, { size: 4.4, align: 'center' });
    this.drawTextBox(doc, fonts, '(ф.и.о.)', 390.8, 64, 207.7, 8, { size: 4.4, align: 'center' });
    this.drawTextBox(doc, fonts, '(реквизиты свидетельства о государственной регистрации индивидуального предпринимателя)', 598.5, 64, 224.5, 8, {
      size: 4.2,
      align: 'center'
    });

    this.drawTextBox(doc, fonts, 'Основание передачи (сдачи) / получения (приемки)', 18, 86, 205, 12, {
      size: 5.9,
      bold: true
    });
    this.drawHorizontalRule(doc, 228, 785, 95.2);
    this.drawTextBox(doc, fonts, basis, 229, 82.3, 554, 12, { size: 5.6, align: 'center' });
    this.drawTextBox(doc, fonts, '(10)', 800, 86, 23, 8, { size: 5.4, align: 'right' });
    this.drawTextBox(doc, fonts, '(договор; доверенность и др.)', 228, 97.2, 557, 8, { size: 4.5, align: 'center' });

    this.drawTextBox(doc, fonts, 'Данные о транспортировке и грузе', 18, 106.5, 145, 12, {
      size: 5.9,
      bold: true
    });
    this.drawHorizontalRule(doc, 168.8, 785, 111.8);
    this.drawTextBox(doc, fonts, 'Услуги оказаны, груз и транспортировка отсутствуют', 170, 103.5, 613, 7, {
      size: 5.6,
      align: 'center'
    });
    this.drawTextBox(doc, fonts, '(11)', 800, 106.5, 23, 8, { size: 5.4, align: 'right' });
    this.drawTextBox(doc, fonts, '(транспортная накладная, поручение экспедитору, экспедиторская / складская расписка и др.)', 168.8, 113.8, 616.2, 8, {
      size: 4.5,
      align: 'center'
    });

    this.drawVerticalRule(doc, 419.2, 137.2, 258, 0.75);
    this.drawTextBox(doc, fonts, 'Товар (груз) передал / услуги,\nрезультаты работ, права сдал', 18, 137.2, 84, 18, {
      size: 5.8,
      bold: true
    });
    this.drawTextBox(doc, fonts, 'Товар (груз) получил / услуги,\nрезультаты работ, права принял', 429, 137.2, 118, 18, {
      size: 5.8,
      bold: true
    });

    this.drawHorizontalRule(doc, 103.5, 320.2, 155.2);
    this.drawHorizontalRule(doc, 552, 785, 155.2);
    this.drawTextBox(doc, fonts, signer, 104, 142, 216, 12, { size: 5.8, align: 'center' });
    this.drawTextBox(doc, fonts, buyerSigner || '', 553, 142, 231, 12, { size: 5.8, align: 'center' });
    this.drawTextBox(doc, fonts, '(должность, подпись, ф.и.о.)', 103.5, 157.2, 216.7, 8, { size: 4.5, align: 'center' });
    this.drawTextBox(doc, fonts, '(должность, подпись, ф.и.о.)', 552, 157.2, 233, 8, { size: 4.5, align: 'center' });
    this.drawTextBox(doc, fonts, '(12)', 333, 146, 22, 8, { size: 5.4, align: 'right' });
    this.drawTextBox(doc, fonts, '(17)', 800, 146, 23, 8, { size: 5.4, align: 'right' });

    this.drawTextBox(doc, fonts, 'Дата отгрузки, передачи\n(сдачи)', 18, 169, 76, 17, { size: 5.8, bold: true });
    this.drawTextBox(doc, fonts, 'Дата получения\n(приемки)', 429, 169, 76, 17, { size: 5.8, bold: true });
    this.drawDateLine(doc, fonts, 103.5, 171.8, day, month, year);
    this.drawDateLine(doc, fonts, 552, 171.8, '', '', '');
    this.drawTextBox(doc, fonts, '(13)', 333, 171, 22, 8, { size: 5.4, align: 'right' });
    this.drawTextBox(doc, fonts, '(18)', 800, 171, 23, 8, { size: 5.4, align: 'right' });

    this.drawTextBox(doc, fonts, 'Иные сведения\nоб отгрузке, передаче', 18, 190, 79, 17, { size: 5.8, bold: true });
    this.drawTextBox(doc, fonts, 'Иные сведения\nо получении, приемке', 429, 190, 79, 17, { size: 5.8, bold: true });
    this.drawHorizontalRule(doc, 103.5, 320.2, 190.5);
    this.drawHorizontalRule(doc, 552, 785, 190.5);
    this.drawTextBox(doc, fonts, 'Услуги оказаны в полном объеме', 104, 177.7, 216, 11, { size: 5.6, align: 'center' });
    this.drawTextBox(doc, fonts, '(14)', 333, 188, 22, 8, { size: 5.4, align: 'right' });
    this.drawTextBox(doc, fonts, '(19)', 800, 188, 23, 8, { size: 5.4, align: 'right' });

    this.drawTextBox(doc, fonts, 'Ответственный за правильность\nоформления факта\nхозяйственной жизни', 18, 211.5, 84, 22, {
      size: 5.8,
      bold: true
    });
    this.drawTextBox(doc, fonts, 'Ответственный за правильность\nоформления факта\nхозяйственной жизни', 429, 211.5, 94, 22, {
      size: 5.8,
      bold: true
    });
    this.drawHorizontalRule(doc, 103.5, 320.2, 216);
    this.drawHorizontalRule(doc, 552, 785, 216);
    this.drawTextBox(doc, fonts, signer, 104, 202.8, 216, 12, { size: 5.8, align: 'center' });
    this.drawTextBox(doc, fonts, buyerSigner || '', 553, 202.8, 231, 12, { size: 5.8, align: 'center' });
    this.drawTextBox(doc, fonts, '(15)', 333, 213, 22, 8, { size: 5.4, align: 'right' });
    this.drawTextBox(doc, fonts, '(20)', 800, 213, 23, 8, { size: 5.4, align: 'right' });
    this.drawTextBox(doc, fonts, '(должность, подпись, ф.и.о.)', 103.5, 218, 216.7, 8, { size: 4.5, align: 'center' });
    this.drawTextBox(doc, fonts, '(должность, подпись, ф.и.о.)', 552, 218, 233, 8, { size: 4.5, align: 'center' });

    this.drawTextBox(doc, fonts, 'Наименование экономического\nсубъекта - составителя\nдокумента', 18, 235.5, 84, 23, { size: 5.8, bold: true });
    this.drawTextBox(doc, fonts, 'Наименование экономического\nсубъекта - составителя\nдокумента', 429, 235.5, 94, 23, { size: 5.8, bold: true });
    this.drawHorizontalRule(doc, 103.5, 320.2, 241.5);
    this.drawHorizontalRule(doc, 552, 785, 241.5);
    this.drawTextBox(doc, fonts, `${seller}, ИНН ${this.clean(organization.inn) || '-'}`, 104, 228.8, 216, 11, {
      size: 5.4,
      align: 'center'
    });
    this.drawTextBox(doc, fonts, `${buyer}, ИНН ${this.clean(client.inn) || '-'}`, 553, 228.8, 231, 11, {
      size: 5.4,
      align: 'center'
    });
    this.drawTextBox(doc, fonts, '(16)', 333, 238.5, 22, 8, { size: 5.4, align: 'right' });
    this.drawTextBox(doc, fonts, '(21)', 800, 238.5, 23, 8, { size: 5.4, align: 'right' });
    this.drawTextBox(doc, fonts, '(М.П.)', 18, 260, 70, 8, { size: 5.2, align: 'center' });
    this.drawTextBox(doc, fonts, '(М.П.)', 429, 260, 70, 8, { size: 5.2, align: 'center' });
  }

  private drawHorizontalRule(
    doc: PDFKit.PDFDocument,
    fromX: number,
    toX: number,
    y: number,
    width = 0.45
  ) {
    doc.save();
    doc.lineWidth(width).moveTo(fromX, y).lineTo(toX, y).stroke();
    doc.restore();
  }

  private drawVerticalRule(
    doc: PDFKit.PDFDocument,
    x: number,
    fromY: number,
    toY: number,
    width = 0.45
  ) {
    doc.save();
    doc.lineWidth(width).moveTo(x, fromY).lineTo(x, toY).stroke();
    doc.restore();
  }

  private drawBox(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number) {
    doc.save();
    doc.rect(x, y, width, height).stroke();
    doc.restore();
  }

  private drawInvoiceTopLine(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    label: string,
    number: string,
    date: string,
    code: string,
    y: number
  ) {
    const labelX = 96;
    const firstLineX = 171;
    const secondLabelX = 247.5;
    const secondLineX = 261;
    const lineY = y + 8;

    this.drawTextBox(doc, fonts, label, labelX, y - 1, 73, 9, { size: 6.2, bold: true });
    this.drawHorizontalRule(doc, firstLineX, 246, lineY);
    this.drawTextBox(doc, fonts, number || '-', firstLineX + 2, y - 1, 73, 9, { size: 6.2, align: 'center' });
    this.drawTextBox(doc, fonts, 'от', secondLabelX, y - 1, 12, 9, { size: 6.2, bold: true, align: 'center' });
    this.drawHorizontalRule(doc, secondLineX, 336, lineY);
    this.drawTextBox(doc, fonts, date || '-', secondLineX + 2, y - 1, 73, 9, { size: 6.2, align: 'center' });
    this.drawTextBox(doc, fonts, code, 800, y - 1, 22, 9, { size: 6.2 });
  }

  private drawDateLine(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    x: number,
    lineY: number,
    day: string,
    month: string,
    year: string
  ) {
    this.drawHorizontalRule(doc, x, x + 216.7, lineY);
    if (day || month || year) {
      this.drawTextBox(doc, fonts, `"${day}" ${month} ${year} г.`, x, lineY - 9.5, 216.7, 8, {
        size: 5.6,
        align: 'center'
      });
    }
    this.drawTextBox(doc, fonts, '(дата)', x, lineY + 4, 216.7, 8, { size: 4.5, align: 'center' });
  }

  private drawPageFooter(
    doc: PDFKit.PDFDocument,
    fonts: PdfFonts,
    work: WorkLike,
    pageNumber: number,
    totalPages: number
  ) {
    const documentNumber = this.clean(work.invoiceNumber || work.actNumber) || '-';

    this.drawTextBox(doc, fonts, `Номер документа: ${documentNumber}`, 18, 566, 220, 9, {
      size: 5.8
    });
    this.drawTextBox(doc, fonts, `${pageNumber} / ${totalPages}`, 18, 566, this.page.right - this.page.left, 9, {
      size: 5.8,
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

  private personShortName(value?: string) {
    const cleaned = this.clean(value)
      .replace(/\s+/g, ' ')
      .replace(/^ИП\s+/iu, '');
    if (!cleaned) {
      return '';
    }

    const compactInitialsMatch = /^([А-ЯЁA-Z][а-яёa-z-]+)\s+([А-ЯЁA-Z])\.\s*([А-ЯЁA-Z])\.?$/u.exec(cleaned);
    if (compactInitialsMatch) {
      return `${compactInitialsMatch[1]} ${compactInitialsMatch[2]}.${compactInitialsMatch[3]}.`;
    }

    const parts = cleaned.split(' ').filter(Boolean);
    if (parts.length < 2 || !/^[А-ЯЁA-Z][а-яёa-z-]+$/u.test(parts[0])) {
      return cleaned;
    }

    const initials = parts
      .slice(1, 3)
      .map((part) => part.charAt(0).toUpperCase())
      .filter(Boolean)
      .map((letter) => `${letter}.`)
      .join('');

    return initials ? `${parts[0]} ${initials}` : cleaned;
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

  private formatUpdDateParts(value?: Date | string): [string, string, string] {
    if (!value) {
      return ['', '', ''];
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return ['', '', ''];
    }

    const months = [
      'января',
      'февраля',
      'марта',
      'апреля',
      'мая',
      'июня',
      'июля',
      'августа',
      'сентября',
      'октября',
      'ноября',
      'декабря'
    ];

    return [String(date.getDate()).padStart(2, '0'), months[date.getMonth()], String(date.getFullYear())];
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
