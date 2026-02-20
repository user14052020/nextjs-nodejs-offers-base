import { getToken } from '@/shared/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
export const getApiUrl = () => API_URL;

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_URL}/api/v1${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || 'Ошибка запроса');
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export async function uploadFiles(path: string, files: File[]) {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  return apiFetch(path, { method: 'POST', body: form });
}

export async function fetchBlob(url: string): Promise<Blob> {
  const token = getToken();
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, { headers, cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Не удалось скачать файл');
  }
  return response.blob();
}

const parseFilenameFromContentDisposition = (contentDisposition: string | null) => {
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] ?? null;
};

export async function fetchApiFile(path: string): Promise<{ blob: Blob; filename: string | null }> {
  const token = getToken();
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}/api/v1${path}`, { headers, cache: 'no-store' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || 'Не удалось скачать файл');
  }

  return {
    blob: await response.blob(),
    filename: parseFilenameFromContentDisposition(response.headers.get('content-disposition'))
  };
}
