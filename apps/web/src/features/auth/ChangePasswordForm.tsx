'use client';

import React from 'react';

import { apiFetch, fetchApiFile } from '@/shared/api/http';
import { Field } from '@/shared/ui/Field';

export const ChangePasswordForm: React.FC = () => {
  const [oldPassword, setOldPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [backupLoading, setBackupLoading] = React.useState(false);
  const [backupMessage, setBackupMessage] = React.useState<string | null>(null);
  const [backupError, setBackupError] = React.useState<string | null>(null);
  const [restoreFile, setRestoreFile] = React.useState<File | null>(null);
  const [restoreLoading, setRestoreLoading] = React.useState(false);
  const [restoreMessage, setRestoreMessage] = React.useState<string | null>(null);
  const [restoreError, setRestoreError] = React.useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword })
      });
      setMessage('Пароль обновлен');
      setOldPassword('');
      setNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить пароль');
    } finally {
      setLoading(false);
    }
  };

  const handleBackupDownload = async () => {
    setBackupLoading(true);
    setBackupMessage(null);
    setBackupError(null);

    try {
      const { blob, filename } = await fetchApiFile('/backup/download');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `offers-base-backup-${new Date().toISOString()}.json.gz`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setBackupMessage('Бэкап успешно скачан');
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'Не удалось выгрузить бэкап');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreSubmit = async () => {
    if (!restoreFile) {
      setRestoreError('Выберите файл бэкапа');
      return;
    }

    if (!window.confirm('Восстановление очистит текущие данные и заменит их бэкапом. Продолжить?')) {
      return;
    }

    setRestoreLoading(true);
    setRestoreMessage(null);
    setRestoreError(null);

    try {
      const formData = new FormData();
      formData.append('file', restoreFile);

      const result = await apiFetch<{ message: string; collections: number; documents: number }>(
        '/backup/restore',
        {
          method: 'POST',
          body: formData
        }
      );

      setRestoreMessage(
        `${result.message}. Коллекций: ${result.collections}, документов: ${result.documents}.`
      );
      setRestoreFile(null);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Не удалось восстановить бэкап');
    } finally {
      setRestoreLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card grid" style={{ gap: 16, maxWidth: 560 }}>
      <div>
        <h2>Смена пароля</h2>
        <p className="muted">Новый пароль минимум 6 символов.</p>
      </div>

      <Field label="Текущий пароль">
        <input
          type="password"
          className="input"
          value={oldPassword}
          onChange={(event) => setOldPassword(event.target.value)}
        />
      </Field>

      <Field label="Новый пароль">
        <input
          type="password"
          className="input"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
      </Field>

      {message && <div className="badge">{message}</div>}
      {error && <div className="badge" style={{ background: '#ffe2d9' }}>{error}</div>}

      <button className="button" type="submit" disabled={loading || !oldPassword || !newPassword}>
        {loading ? 'Сохраняем...' : 'Обновить пароль'}
      </button>

      <div className="grid" style={{ gap: 10, borderTop: '1px solid #e6ded4', paddingTop: 14 }}>
        <h3 style={{ margin: 0 }}>Бэкап базы</h3>
        <p className="muted" style={{ margin: 0 }}>
          Выгрузка полного бэкапа MongoDB в формате `.json.gz`.
        </p>
        {backupMessage && <div className="badge">{backupMessage}</div>}
        {backupError && <div className="badge" style={{ background: '#ffe2d9' }}>{backupError}</div>}
        <button className="button secondary" type="button" disabled={backupLoading} onClick={handleBackupDownload}>
          {backupLoading ? 'Выгружаем...' : 'Скачать бэкап'}
        </button>

        <div className="grid" style={{ gap: 10, marginTop: 4 }}>
          <label className="grid" style={{ gap: 6 }}>
            <span className="label">Файл для восстановления</span>
            <input
              type="file"
              className="input"
              accept=".json,.gz,.json.gz,application/gzip,application/json"
              onChange={(event) => setRestoreFile(event.target.files?.[0] ?? null)}
            />
          </label>
          {restoreMessage && <div className="badge">{restoreMessage}</div>}
          {restoreError && <div className="badge" style={{ background: '#ffe2d9' }}>{restoreError}</div>}
          <button
            className="button secondary"
            type="button"
            disabled={restoreLoading || !restoreFile}
            onClick={handleRestoreSubmit}
          >
            {restoreLoading ? 'Восстанавливаем...' : 'Восстановить из бэкапа'}
          </button>
        </div>
      </div>
    </form>
  );
};
