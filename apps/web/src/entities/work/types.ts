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
  currency?: string;
  executorOrganizationId: string;
  clientId: string;
  actNumber: string;
  invoiceNumber: string;
  actDate: string;
  invoiceDate: string;
  actYear?: number;
  invoiceYear?: number;
};
