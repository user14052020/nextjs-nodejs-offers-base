import { apiFetch, uploadFiles } from '@/shared/api/http';
import { Organization } from './types';

export const fetchOrganizations = (query?: string) =>
  apiFetch<Organization[]>(
    query?.trim() ? `/organizations?q=${encodeURIComponent(query.trim())}` : '/organizations'
  );
export const createOrganization = (payload: Partial<Organization>) =>
  apiFetch<Organization>('/organizations', { method: 'POST', body: JSON.stringify(payload) });
export const updateOrganization = (id: string, payload: Partial<Organization>) =>
  apiFetch<Organization>(`/organizations/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
export const deleteOrganization = (id: string) =>
  apiFetch(`/organizations/${id}`, { method: 'DELETE' });

export const uploadOrganizationFiles = (id: string, files: File[]) =>
  uploadFiles(`/organizations/${id}/files`, files);

export const deleteOrganizationFile = (id: string, fileId: string) =>
  apiFetch(`/organizations/${id}/files/${fileId}`, { method: 'DELETE' });
