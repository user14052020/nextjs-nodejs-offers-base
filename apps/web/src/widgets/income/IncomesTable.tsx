'use client';

import React from 'react';
import { Alert, Badge, Button, Group, Paper, ScrollArea, Stack, Switch, Table, Text, Title } from '@mantine/core';

import { deleteIncome, incomeReceiptPdfUrl, updateIncome } from '@/entities/income/api';
import { Income, IncomePaymentMethod } from '@/entities/income/types';
import { fetchBlob } from '@/shared/api/http';

export const IncomesTable: React.FC<{
  items: Income[];
  onChange: () => void | Promise<void>;
  onEdit: (income: Income) => void;
}> = ({ items, onChange, onEdit }) => {
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('ru-RU');
  };

  const formatAmount = (value: number) =>
    value.toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  const paymentMethodLabel = (method?: IncomePaymentMethod) => {
    const labels: Record<IncomePaymentMethod, string> = {
      platform: 'Площадка',
      bank_account: 'Расчетный счет',
      card_transfer: 'Карта',
      cash: 'Наличные',
      other: 'Другое'
    };
    return labels[method || 'other'];
  };

  const openPdf = async (url: string) => {
    try {
      setError(null);
      const blob = await fetchBlob(`${url}?v=${Date.now()}`);
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка печати PDF');
    }
  };

  const handleReceivedChange = async (income: Income, isReceived: boolean) => {
    try {
      setError(null);
      setLoadingId(income._id);
      await updateIncome(income._id, { isReceived });
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка обновления дохода');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (income: Income) => {
    try {
      setError(null);
      setLoadingId(income._id);
      await deleteIncome(income._id);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления дохода');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Paper withBorder shadow="sm" radius="lg" p="xl">
      <Stack gap="md">
        <div>
          <Title order={3}>Доходы без счетов</Title>
          <Text size="sm" c="dimmed">
            Поступления с площадок ведутся отдельно от счетов и актов, чтобы не занимать номера документов.
          </Text>
        </div>

        {error && <Alert color="red">{error}</Alert>}

        <ScrollArea>
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Дата</Table.Th>
                <Table.Th>Источник</Table.Th>
                <Table.Th>Покупатель</Table.Th>
                <Table.Th>Заказ</Table.Th>
                <Table.Th>Оплата</Table.Th>
                <Table.Th>Валовый доход</Table.Th>
                <Table.Th>Зачислено</Table.Th>
                <Table.Th>Комиссия</Table.Th>
                <Table.Th>Документ</Table.Th>
                <Table.Th>Получено</Table.Th>
                <Table.Th>Действия</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((income) => (
                <Table.Tr key={income._id}>
                  <Table.Td>{formatDate(income.incomeDate)}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={income.source === 'kwork' ? 'dark' : 'gray'}>
                      {income.sourceName || income.source}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{income.customerName || '—'}</Table.Td>
                  <Table.Td>{income.orderTitle || income.description}</Table.Td>
                  <Table.Td>{paymentMethodLabel(income.paymentMethod)}</Table.Td>
                  <Table.Td>
                    {formatAmount(income.grossAmount)} {income.currency || 'RUB'}
                  </Table.Td>
                  <Table.Td>
                    {formatAmount(income.netAmount)} {income.currency || 'RUB'}
                  </Table.Td>
                  <Table.Td>
                    {formatAmount((income.platformCommission ?? 0) + (income.payoutCommission ?? 0))}{' '}
                    {income.currency || 'RUB'}
                  </Table.Td>
                  <Table.Td>
                    {income.confirmationDocumentType === 'receipt' ? (
                      <Button
                        variant="light"
                        color="gray"
                        size="xs"
                        onClick={() => openPdf(incomeReceiptPdfUrl(income._id))}
                      >
                        Квитанция {income.receiptNumber || ''}
                      </Button>
                    ) : (
                      <Badge variant="light" color="gray">
                        Отчет площадки
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Switch
                      checked={Boolean(income.isReceived)}
                      color="dark"
                      size="sm"
                      label={income.isReceived ? 'Да' : 'Нет'}
                      disabled={loadingId === income._id}
                      onChange={(event) => handleReceivedChange(income, event.currentTarget.checked)}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="wrap">
                      <Button variant="light" color="gray" size="xs" onClick={() => onEdit(income)}>
                        Редактировать
                      </Button>
                      <Button
                        variant="light"
                        color="red"
                        size="xs"
                        disabled={loadingId === income._id}
                        onClick={() => handleDelete(income)}
                      >
                        Удалить
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>

        {items.length === 0 && (
          <Text size="sm" c="dimmed">
            Пока нет отдельных доходов.
          </Text>
        )}
      </Stack>
    </Paper>
  );
};
