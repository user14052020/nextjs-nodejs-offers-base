'use client';

import React from 'react';

import {
  deleteOrganization,
  deleteOrganizationFile,
  uploadOrganizationFiles
} from '@/entities/organization/api';
import { Organization } from '@/entities/organization/types';
import { getApiUrl, fetchBlob } from '@/shared/api/http';
import { formatFileSize } from '@/shared/lib/format';

export const OrganizationsTable: React.FC<{
  items: Organization[];
  onChange: () => void;
  onEdit: (organization: Organization) => void;
}> = ({ items, onChange, onEdit }) => {
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const getStringId = (value: unknown) => {
    if (typeof value === 'string') {
      return value;
    }

    if (value && typeof value === 'object' && '$oid' in value) {
      const oid = (value as { $oid?: unknown }).$oid;
      if (typeof oid === 'string') {
        return oid;
      }
    }

    return '';
  };

  const getFileId = (file: unknown) => {
    const directId = getStringId(file);
    if (directId) return directId;

    if (!file || typeof file !== 'object') {
      return '';
    }

    const candidate = file as { _id?: unknown; id?: unknown };
    const mongoId = getStringId(candidate._id);
    if (mongoId) return mongoId;
    const altId = getStringId(candidate.id);
    if (altId) return altId;

    return '';
  };

  const getFileName = (file: unknown, fallbackId: string) => {
    if (file && typeof file === 'object' && 'filename' in file) {
      const filename = (file as { filename?: unknown }).filename;
      if (typeof filename === 'string' && filename.trim()) {
        return filename;
      }
    }
    return fallbackId ? `Файл ${fallbackId.slice(0, 8)}` : 'Файл без имени';
  };

  const getFileSize = (file: unknown) => {
    if (file && typeof file === 'object' && 'size' in file) {
      const size = (file as { size?: unknown }).size;
      if (typeof size === 'number') {
        return size;
      }
    }
    return null;
  };

  const handleDelete = async (id: string) => {
    try {
      setError(null);
      setLoadingId(id);
      await deleteOrganization(id);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления организации');
    } finally {
      setLoadingId(null);
    }
  };

  const handleUpload = async (id: string, files: FileList | null) => {
    if (!files?.length) return;
    try {
      setError(null);
      setLoadingId(id);
      await uploadOrganizationFiles(id, Array.from(files));
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки файла');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDeleteFile = async (organizationId: string, fileId: string) => {
    if (!fileId) {
      setError('У файла отсутствует идентификатор');
      return;
    }

    try {
      setError(null);
      setLoadingId(organizationId);
      await deleteOrganizationFile(organizationId, fileId);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления файла');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDownloadFile = async (fileId: string, filename: string) => {
    if (!fileId) {
      setError('У файла отсутствует идентификатор');
      return;
    }

    try {
      setError(null);
      const blob = await fetchBlob(`${getApiUrl()}/api/v1/files/${fileId}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось скачать файл');
    }
  };

  return (
    <div className="card">
      <h3>Список организаций</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Название</th>
            <th>Короткое имя</th>
            <th>ИНН</th>
            <th>Банк</th>
            <th>Файлы</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((org) => (
            <tr key={org._id}>
              <td>{org.name}</td>
              <td>{org.shortName || '—'}</td>
              <td>{org.inn || '—'}</td>
              <td>{org.bankName || '—'}</td>
              <td>
                <div className="grid" style={{ gap: 6 }}>
                  {(org.files || []).filter(Boolean).map((file, index) => {
                    const fileId = getFileId(file);
                    const fileName = getFileName(file, fileId);
                    const fileSize = getFileSize(file);

                    return (
                      <div key={fileId || `${org._id}-${index}`} className="flex" style={{ gap: 8 }}>
                        <button
                          className="button secondary"
                          type="button"
                          disabled={!fileId}
                          onClick={() => handleDownloadFile(fileId, fileName)}
                        >
                          {fileName}
                        </button>
                        <span className="muted">{formatFileSize(fileSize)}</span>
                        <button
                          className="button secondary"
                          type="button"
                          disabled={loadingId === org._id || !fileId}
                          onClick={() => handleDeleteFile(org._id, fileId)}
                        >
                          Удалить
                        </button>
                      </div>
                    );
                  })}
                  {(org.files || []).length === 0 && <span className="muted">Нет вложений</span>}
                </div>
              </td>
              <td className="flex">
                <label className="button secondary">
                  Загрузить
                  <input
                    type="file"
                    multiple
                    hidden
                    onChange={(event) => handleUpload(org._id, event.target.files)}
                  />
                </label>
                <button
                  className="button secondary"
                  type="button"
                  disabled={loadingId === org._id}
                  onClick={() => onEdit(org)}
                >
                  Редактировать
                </button>
                <button
                  className="button secondary"
                  type="button"
                  disabled={loadingId === org._id}
                  onClick={() => handleDelete(org._id)}
                >
                  Удалить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {error && <p className="muted">{error}</p>}
      {items.length === 0 && <p className="muted">Пока нет организаций.</p>}
    </div>
  );
};
