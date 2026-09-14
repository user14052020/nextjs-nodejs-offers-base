export type WorkItem = {
  name: string;
  quantity: number;
  price: number;
  amount?: number;
};

export type Work = {
  _id: string;
  items: WorkItem[];
  amount: number;
  creditedAmount?: number;
  isPayed?: boolean;
  currency?: string;
  source?: 'document' | 'kwork';
  sourceName?: string;
  platformCommission?: number;
  payoutCommission?: number;
  executorOrganizationId: string;
  clientId: string;
  actNumber: string;
  invoiceNumber: string;
  actDate: string;
  invoiceDate: string;
  actYear?: number;
  invoiceYear?: number;
};

export type BalanceReportImportWarning = {
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
