import { apiFetch, getApiPath } from '@/shared/api/http';
import { BalanceReportImportResult, Work } from './types';

export const fetchWorks = (query?: string) =>
  apiFetch<Work[]>(query?.trim() ? `/works?q=${encodeURIComponent(query.trim())}` : '/works');
export const createWork = (payload: Partial<Work>) =>
  apiFetch<Work>('/works', { method: 'POST', body: JSON.stringify(payload) });
export const updateWork = (id: string, payload: Partial<Work>) =>
  apiFetch<Work>(`/works/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
export const deleteWork = (id: string) => apiFetch(`/works/${id}`, { method: 'DELETE' });

export const importKworkBalanceReport = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch<BalanceReportImportResult>('/works/imports/kwork-balance-report', {
    method: 'POST',
    body: formData
  });
};

export const actPdfUrl = (id: string) => getApiPath(`/works/${id}/act.pdf`);
export const invoicePdfUrl = (id: string) => getApiPath(`/works/${id}/invoice.pdf`);
export const updPdfUrl = (id: string) => getApiPath(`/works/${id}/upd.pdf`);
