export type MonthlyClientReportRow = {
  clientId: string;
  clientName: string;
  worksCount: number;
  totalAmount: number;
  totalCreditedAmount: number;
};

export type MonthlyClientReportMonth = {
  monthKey: string;
  monthLabel: string;
  totalWorks: number;
  totalAmount: number;
  totalCreditedAmount: number;
  clients: MonthlyClientReportRow[];
};
