'use client';

import React from 'react';
import {
  Alert,
  Button,
  Divider,
  FileInput,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  Title
} from '@mantine/core';

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

      setRestoreMessage(`${result.message}. Коллекций: ${result.collections}, документов: ${result.documents}.`);
      setRestoreFile(null);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Не удалось восстановить бэкап');
    } finally {
      setRestoreLoading(false);
    }
  };

  return (
    <Paper withBorder shadow="sm" radius="lg" p="xl" component="form" onSubmit={handleSubmit}>
      <Stack gap="md" maw={640}>
        <div>
          <Title order={2}>Смена пароля</Title>
          <Text c="dimmed" size="sm">
            Новый пароль минимум 6 символов.
          </Text>
        </div>

        <Field label="Текущий пароль">
          <PasswordInput value={oldPassword} onChange={(event) => setOldPassword(event.currentTarget.value)} />
        </Field>

        <Field label="Новый пароль">
          <PasswordInput value={newPassword} onChange={(event) => setNewPassword(event.currentTarget.value)} />
        </Field>

        {message && <Alert color="green">{message}</Alert>}
        {error && <Alert color="red">{error}</Alert>}

        <Button type="submit" loading={loading} disabled={!oldPassword || !newPassword}>
          Обновить пароль
        </Button>

        <Divider />

        <Stack gap="sm">
          <Title order={3}>Бэкап базы</Title>
          <Text size="sm" c="dimmed">
            Выгрузка полного бэкапа MongoDB в формате `.json.gz`.
          </Text>
          {backupMessage && <Alert color="green">{backupMessage}</Alert>}
          {backupError && <Alert color="red">{backupError}</Alert>}
          <Group>
            <Button variant="light" loading={backupLoading} onClick={handleBackupDownload}>
              Скачать бэкап
            </Button>
          </Group>
        </Stack>

        <Divider />

        <Stack gap="sm">
          <FileInput
            label="Файл для восстановления"
            placeholder="Выберите файл бэкапа"
            value={restoreFile}
            onChange={setRestoreFile}
            accept=".json,.gz,.json.gz,application/gzip,application/json"
          />
          {restoreMessage && <Alert color="green">{restoreMessage}</Alert>}
          {restoreError && <Alert color="red">{restoreError}</Alert>}
          <Group>
            <Button
              variant="light"
              color="orange"
              loading={restoreLoading}
              disabled={!restoreFile}
              onClick={handleRestoreSubmit}
            >
              Восстановить из бэкапа
            </Button>
          </Group>
        </Stack>
      </Stack>
    </Paper>
  );
};
