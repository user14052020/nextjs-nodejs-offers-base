import { apiFetch } from '@/shared/api/http';
import { Work } from './types';

export const fetchWorks = (query?: string) =>
  apiFetch<Work[]>(query?.trim() ? `/works?q=${encodeURIComponent(query.trim())}` : '/works');
export const createWork = (payload: Partial<Work>) =>
  apiFetch<Work>('/works', { method: 'POST', body: JSON.stringify(payload) });
export const updateWork = (id: string, payload: Partial<Work>) =>
  apiFetch<Work>(`/works/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
export const deleteWork = (id: string) => apiFetch(`/works/${id}`, { method: 'DELETE' });

export const actPdfUrl = (id: string) =>
  `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/v1/works/${id}/act.pdf`;
export const invoicePdfUrl = (id: string) =>
  `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/v1/works/${id}/invoice.pdf`;
