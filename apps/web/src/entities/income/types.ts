export type IncomeSource = 'kwork' | 'manual';
export type IncomePaymentMethod = 'platform' | 'bank_account' | 'card_transfer' | 'cash' | 'other';
export type IncomeConfirmationDocumentType = 'platform_report' | 'receipt' | 'none';

export type Income = {
  _id: string;
  source: IncomeSource;
  sourceName: string;
  incomeDate: string;
  description: string;
  customerName?: string;
  orderTitle?: string;
  grossAmount: number;
  netAmount: number;
  platformCommission: number;
  payoutCommission: number;
  currency: string;
  isReceived: boolean;
  paymentMethod: IncomePaymentMethod;
  confirmationDocumentType: IncomeConfirmationDocumentType;
  receiptNumber?: string;
  receiptDate?: string;
  receiptYear?: number;
  settlementPlace?: string;
  taxRegime?: string;
  cashRegisterExemptionReason?: string;
};

export type CreateIncomePayload = {
  source: IncomeSource;
  sourceName: string;
  incomeDate: string;
  description: string;
  customerName?: string;
  orderTitle?: string;
  grossAmount: number;
  netAmount: number;
  platformCommission?: number;
  payoutCommission?: number;
  currency?: string;
  isReceived?: boolean;
  paymentMethod?: IncomePaymentMethod;
  confirmationDocumentType?: IncomeConfirmationDocumentType;
  receiptNumber?: string;
  receiptDate?: string;
  settlementPlace?: string;
  taxRegime?: string;
  cashRegisterExemptionReason?: string;
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
