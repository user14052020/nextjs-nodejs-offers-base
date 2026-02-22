'use client';

import React from 'react';
import { Alert, Button, Group, Paper, Stack, Table, Text, Title } from '@mantine/core';

import { Organization } from '@/entities/organization/types';
import { deleteOrganization, deleteOrganizationFile, uploadOrganizationFiles } from '@/entities/organization/api';
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
    <Paper withBorder shadow="sm" radius="lg" p="xl">
      <Stack gap="md">
        <Title order={3}>Список организаций</Title>
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Название</Table.Th>
              <Table.Th>Короткое имя</Table.Th>
              <Table.Th>ИНН</Table.Th>
              <Table.Th>Банк</Table.Th>
              <Table.Th>Файлы</Table.Th>
              <Table.Th>Действия</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((org) => (
              <Table.Tr key={org._id}>
                <Table.Td>{org.name}</Table.Td>
                <Table.Td>{org.shortName || '—'}</Table.Td>
                <Table.Td>{org.inn || '—'}</Table.Td>
                <Table.Td>{org.bankName || '—'}</Table.Td>
                <Table.Td>
                  <Stack gap={6}>
                    {(org.files || []).filter(Boolean).map((file, index) => {
                      const fileId = getFileId(file);
                      const fileName = getFileName(file, fileId);
                      const fileSize = getFileSize(file);

                      return (
                        <Group key={fileId || `${org._id}-${index}`} gap="xs" wrap="wrap">
                          <Button
                            variant="light"
                            color="gray"
                            size="xs"
                            disabled={!fileId}
                            onClick={() => handleDownloadFile(fileId, fileName)}
                          >
                            {fileName}
                          </Button>
                          <Text size="sm" c="dimmed">
                            {formatFileSize(fileSize)}
                          </Text>
                          <Button
                            variant="light"
                            color="red"
                            size="xs"
                            disabled={loadingId === org._id || !fileId}
                            onClick={() => handleDeleteFile(org._id, fileId)}
                          >
                            Удалить
                          </Button>
                        </Group>
                      );
                    })}
                    {(org.files || []).length === 0 && (
                      <Text size="sm" c="dimmed">
                        Нет вложений
                      </Text>
                    )}
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" wrap="wrap">
                    <Button variant="light" color="gray" size="xs" component="label">
                      Загрузить
                      <input type="file" multiple hidden onChange={(event) => handleUpload(org._id, event.target.files)} />
                    </Button>
                    <Button variant="light" color="gray" size="xs" disabled={loadingId === org._id} onClick={() => onEdit(org)}>
                      Редактировать
                    </Button>
                    <Button variant="light" color="red" size="xs" disabled={loadingId === org._id} onClick={() => handleDelete(org._id)}>
                      Удалить
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {error && <Alert color="red">{error}</Alert>}
        {items.length === 0 && (
          <Text size="sm" c="dimmed">
            Пока нет организаций.
          </Text>
        )}
      </Stack>
    </Paper>
  );
};
