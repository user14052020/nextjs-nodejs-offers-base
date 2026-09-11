'use client';

import React from 'react';
import { Alert, Button, FileInput, Group, Paper, Stack, Text, Title } from '@mantine/core';

import { importClientCompanyCard } from '@/entities/client/api';
import { Client } from '@/entities/client/types';

export const ClientCompanyCardImportForm: React.FC<{ onImported: (client: Client) => void | Promise<void> }> = ({
  onImported
}) => {
  const [file, setFile] = React.useState<File | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [createdClient, setCreatedClient] = React.useState<Client | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleImport = async () => {
    if (!file) {
      setError('Выберите DOCX файл');
      return;
    }

    setLoading(true);
    setError(null);
    setCreatedClient(null);

    try {
      const client = await importClientCompanyCard(file);
      setCreatedClient(client);
      setFile(null);
      await onImported(client);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось импортировать клиента');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper withBorder shadow="sm" radius="lg" p="lg">
      <Stack gap="md">
        <div>
          <Title order={3}>Импорт клиента из карты предприятия</Title>
          <Text c="dimmed" size="sm">
            DOCX с реквизитами заполняет наименование, ИНН, КПП, банк, счета, адрес и контакты.
          </Text>
        </div>

        {error && <Alert color="red">{error}</Alert>}
        {createdClient && (
          <Alert color="gray" title="Клиент создан">
            {createdClient.name}
          </Alert>
        )}

        <Group align="end" wrap="wrap">
          <FileInput
            style={{ flex: 1, minWidth: 280 }}
            label="Файл реквизитов"
            placeholder="Выберите .docx"
            value={file}
            onChange={setFile}
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          />
          <Button variant="light" color="gray" loading={loading} disabled={!file} onClick={handleImport}>
            Создать клиента
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
};
