import { apiFetch, uploadFiles } from '@/shared/api/http';
import { Client } from './types';

export const fetchClients = (query?: string) =>
  apiFetch<Client[]>(query?.trim() ? `/clients?q=${encodeURIComponent(query.trim())}` : '/clients');
export const createClient = (payload: Partial<Client>) =>
  apiFetch<Client>('/clients', { method: 'POST', body: JSON.stringify(payload) });
export const updateClient = (id: string, payload: Partial<Client>) =>
  apiFetch<Client>(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
export const deleteClient = (id: string) => apiFetch(`/clients/${id}`, { method: 'DELETE' });

export const uploadClientFiles = (id: string, files: File[]) =>
  uploadFiles(`/clients/${id}/files`, files);

export const deleteClientFile = (id: string, fileId: string) =>
  apiFetch(`/clients/${id}/files/${fileId}`, { method: 'DELETE' });
