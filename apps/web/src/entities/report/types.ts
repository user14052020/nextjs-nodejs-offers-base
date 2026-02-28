export type MonthlyClientReportRow = {
  clientId: string;
  clientName: string;
  worksCount: number;
  totalAmount: number;
};

export type MonthlyClientReportMonth = {
  monthKey: string;
  monthLabel: string;
  totalWorks: number;
  totalAmount: number;
  clients: MonthlyClientReportRow[];
};
