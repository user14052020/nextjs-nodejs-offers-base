export type MonthlyClientReportRow = {
  clientId: string;
  clientName: string;
  source: 'document' | 'kwork' | 'manual';
  worksCount: number;
  paidWorksCount: number;
  totalAmount: number;
  totalCreditedAmount: number;
  totalPlatformCommission: number;
  totalPayoutCommission: number;
};

export type MonthlyClientReportMonth = {
  monthKey: string;
  monthLabel: string;
  totalWorks: number;
  paidWorksCount: number;
  totalAmount: number;
  totalCreditedAmount: number;
  totalPlatformCommission: number;
  totalPayoutCommission: number;
  clients: MonthlyClientReportRow[];
};

export type MonthlyClientReportSummary = {
  totalWorks: number;
  paidWorksCount: number;
  totalAmount: number;
  totalCreditedAmount: number;
  totalPlatformCommission: number;
  totalPayoutCommission: number;
};

export type MonthlyClientReport = {
  paidOnly: boolean;
  summary: MonthlyClientReportSummary;
  months: MonthlyClientReportMonth[];
};
