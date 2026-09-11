import { apiFetch, getApiPath } from '@/shared/api/http';
import { BalanceReportImportResult, CreateIncomePayload, Income } from './types';

export const fetchIncomes = () => apiFetch<Income[]>('/incomes');

export const createIncome = (payload: CreateIncomePayload) =>
  apiFetch<Income>('/incomes', { method: 'POST', body: JSON.stringify(payload) });

export const updateIncome = (id: string, payload: Partial<Income>) =>
  apiFetch<Income>(`/incomes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });

export const deleteIncome = (id: string) => apiFetch(`/incomes/${id}`, { method: 'DELETE' });

export const importIncomeBalanceReport = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch<BalanceReportImportResult>('/incomes/imports/balance-report', { method: 'POST', body: formData });
};

export const incomeReceiptPdfUrl = (id: string) => getApiPath(`/incomes/${id}/receipt.pdf`);
