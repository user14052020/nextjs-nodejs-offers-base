'use client';

import React from 'react';
import { Alert, Button, Group, Paper, Stack, Table, Text, Title } from '@mantine/core';

import { Client } from '@/entities/client/types';
import { Organization } from '@/entities/organization/types';
import { actPdfUrl, deleteWork, invoicePdfUrl } from '@/entities/work/api';
import { Work } from '@/entities/work/types';
import { fetchBlob } from '@/shared/api/http';

export const WorksTable: React.FC<{
  items: Work[];
  clients: Client[];
  organizations: Organization[];
  onChange: () => void;
  onEdit: (work: Work) => void;
}> = ({ items, clients, organizations, onChange, onEdit }) => {
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const clientMap = React.useMemo(() => new Map(clients.map((c) => [c._id, c.name])), [clients]);
  const orgMap = React.useMemo(() => new Map(organizations.map((o) => [o._id, o.name])), [organizations]);
  const formatAmount = (value: number) =>
    value.toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  const getWorkItemsText = (work: Work) => {
    if (Array.isArray(work.items) && work.items.length) {
      return work.items.map((item) => item.name).join('; ');
    }
    return '—';
  };

  const handleDelete = async (id: string) => {
    setLoadingId(id);
    await deleteWork(id);
    setLoadingId(null);
    onChange();
  };

  const openPdf = async (url: string) => {
    try {
      setError(null);
      const blob = await fetchBlob(url);
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка печати PDF');
    }
  };

  const withCacheBust = (url: string) => {
    const delimiter = url.includes('?') ? '&' : '?';
    return `${url}${delimiter}v=${Date.now()}`;
  };

  return (
    <Paper withBorder shadow="sm" radius="lg" p="xl">
      <Stack gap="md">
        <div>
          <Title order={3}>Работы и документы</Title>
          <Text size="sm" c="dimmed">
            Кнопки печати открывают PDF в новой вкладке, где доступна печать и сохранение.
          </Text>
        </div>
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Позиции</Table.Th>
              <Table.Th>Организация</Table.Th>
              <Table.Th>Клиент</Table.Th>
              <Table.Th>Акт</Table.Th>
              <Table.Th>Счет</Table.Th>
              <Table.Th>Сумма</Table.Th>
              <Table.Th>Действия</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((work) => {
              const missingOrganization = !orgMap.has(work.executorOrganizationId);
              const missingClient = !clientMap.has(work.clientId);
              const hasMissingLinks = missingOrganization || missingClient;
              const missingLinksHint =
                'Для печати нужно открыть работу в режиме редактирования и заново выбрать организацию/клиента.';

              return (
                <Table.Tr key={work._id}>
                  <Table.Td>{getWorkItemsText(work)}</Table.Td>
                  <Table.Td>{orgMap.get(work.executorOrganizationId) ?? '—'}</Table.Td>
                  <Table.Td>{clientMap.get(work.clientId) ?? '—'}</Table.Td>
                  <Table.Td>
                    <Button
                      variant="light"
                      color="gray"
                      size="xs"
                      disabled={hasMissingLinks}
                      title={hasMissingLinks ? missingLinksHint : undefined}
                      onClick={() => openPdf(withCacheBust(actPdfUrl(work._id)))}
                    >
                      АКТ {work.actNumber}
                    </Button>
                  </Table.Td>
                  <Table.Td>
                    <Button
                      variant="light"
                      color="gray"
                      size="xs"
                      disabled={hasMissingLinks}
                      title={hasMissingLinks ? missingLinksHint : undefined}
                      onClick={() => openPdf(withCacheBust(invoicePdfUrl(work._id)))}
                    >
                      СЧЕТ {work.invoiceNumber}
                    </Button>
                  </Table.Td>
                  <Table.Td>
                    {formatAmount(work.amount)} {work.currency || 'RUB'}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="wrap">
                      <Button variant="light" color="gray" size="xs" onClick={() => onEdit(work)}>
                        Редактировать
                      </Button>
                      <Button
                        variant="light"
                        color="red"
                        size="xs"
                        disabled={loadingId === work._id}
                        onClick={() => handleDelete(work._id)}
                      >
                        Удалить
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
        {error && <Alert color="red">{error}</Alert>}
        {items.length === 0 && (
          <Text size="sm" c="dimmed">
            Пока нет работ.
          </Text>
        )}
      </Stack>
    </Paper>
  );
};
