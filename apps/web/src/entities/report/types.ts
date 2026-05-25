export type MonthlyClientReportRow = {
  clientId: string;
  clientName: string;
  worksCount: number;
  paidWorksCount: number;
  totalAmount: number;
  totalCreditedAmount: number;
};

export type MonthlyClientReportMonth = {
  monthKey: string;
  monthLabel: string;
  totalWorks: number;
  paidWorksCount: number;
  totalAmount: number;
  totalCreditedAmount: number;
  clients: MonthlyClientReportRow[];
};

export type MonthlyClientReportSummary = {
  totalWorks: number;
  paidWorksCount: number;
  totalAmount: number;
  totalCreditedAmount: number;
};

export type MonthlyClientReport = {
  paidOnly: boolean;
  summary: MonthlyClientReportSummary;
  months: MonthlyClientReportMonth[];
};
