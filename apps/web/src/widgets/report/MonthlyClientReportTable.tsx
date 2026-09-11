'use client';

import React from 'react';
import { Accordion, Badge, Group, Paper, ScrollArea, Stack, Table, Text, Title } from '@mantine/core';

import { MonthlyClientReportMonth } from '@/entities/report/types';

export const MonthlyClientReportTable: React.FC<{ months: MonthlyClientReportMonth[]; paidOnly: boolean }> = ({
  months,
  paidOnly
}) => {
  const formatAmount = (value: number) =>
    value.toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  const formatPercent = (value: number) =>
    value.toLocaleString('ru-RU', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });

  const sourceLabel = (source: string) => {
    if (source === 'document') return 'Счет/акт';
    if (source === 'kwork') return 'Kwork';
    return 'Доход';
  };

  if (months.length === 0) {
    return (
      <Paper withBorder shadow="sm" radius="lg" p="xl">
        <Text c="dimmed">Пока недостаточно данных для построения отчета.</Text>
      </Paper>
    );
  }

  return (
    <Paper withBorder shadow="sm" radius="lg" p="xl">
      <Stack gap="md">
        <div>
          <Title order={3}>Книга доходов по месяцам</Title>
          <Text size="sm" c="dimmed">
            {paidOnly ? 'Учитываются только полученные доходы.' : 'Учитываются все записи.'} Счета/акты и доходы
            площадок сведены в один отчет, но остаются разными источниками.
          </Text>
        </div>

        <Accordion variant="separated" defaultValue={months[0].monthKey}>
          {months.map((month) => (
            <Accordion.Item key={month.monthKey} value={month.monthKey}>
              <Accordion.Control>
                <Group justify="space-between" wrap="wrap">
                  <Text fw={600}>{month.monthLabel}</Text>
                  <Group gap="xs">
                    <Badge variant="light" color="gray">
                      Записей: {month.totalWorks}
                    </Badge>
                    <Badge variant="light" color="dark">
                      Получено: {month.paidWorksCount}
                    </Badge>
                    <Badge variant="light" color="dark">
                      Доход: {formatAmount(month.totalAmount)} ₽
                    </Badge>
                    <Badge variant="light" color="gray">
                      На счет: {formatAmount(month.totalCreditedAmount)} ₽
                    </Badge>
                    <Badge variant="light" color="gray">
                      Комиссия: {formatAmount(month.totalPlatformCommission + month.totalPayoutCommission)} ₽
                    </Badge>
                  </Group>
                </Group>
              </Accordion.Control>

              <Accordion.Panel>
                <Stack gap="sm">
                  <ScrollArea>
                    <Table striped highlightOnHover withTableBorder withColumnBorders>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Источник</Table.Th>
                          <Table.Th>Клиент / покупатель</Table.Th>
                          <Table.Th>Записей</Table.Th>
                          <Table.Th>Получено</Table.Th>
                          <Table.Th>Доход</Table.Th>
                          <Table.Th>На счет</Table.Th>
                          <Table.Th>Комиссия</Table.Th>
                          <Table.Th>Доля месяца</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {month.clients.map((client) => {
                          const share = month.totalAmount > 0 ? (client.totalAmount / month.totalAmount) * 100 : 0;
                          const commission = client.totalPlatformCommission + client.totalPayoutCommission;

                          return (
                            <Table.Tr key={`${month.monthKey}-${client.clientId}`}>
                              <Table.Td>
                                <Badge variant="light" color={client.source === 'document' ? 'gray' : 'dark'}>
                                  {sourceLabel(client.source)}
                                </Badge>
                              </Table.Td>
                              <Table.Td>{client.clientName}</Table.Td>
                              <Table.Td>{client.worksCount}</Table.Td>
                              <Table.Td>{client.paidWorksCount}</Table.Td>
                              <Table.Td>{formatAmount(client.totalAmount)} ₽</Table.Td>
                              <Table.Td>{formatAmount(client.totalCreditedAmount)} ₽</Table.Td>
                              <Table.Td>{formatAmount(commission)} ₽</Table.Td>
                              <Table.Td>{formatPercent(share)}%</Table.Td>
                            </Table.Tr>
                          );
                        })}
                        <Table.Tr>
                          <Table.Td colSpan={2}>
                            <Text fw={700}>Итого за месяц</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text fw={700}>{month.totalWorks}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text fw={700}>{month.paidWorksCount}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text fw={700}>{formatAmount(month.totalAmount)} ₽</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text fw={700}>{formatAmount(month.totalCreditedAmount)} ₽</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text fw={700}>
                              {formatAmount(month.totalPlatformCommission + month.totalPayoutCommission)} ₽
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text fw={700}>100,0%</Text>
                          </Table.Td>
                        </Table.Tr>
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </Stack>
    </Paper>
  );
};
