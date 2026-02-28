'use client';

import React from 'react';
import { Accordion, Badge, Group, Paper, ScrollArea, Stack, Table, Text, Title } from '@mantine/core';

import { MonthlyClientReportMonth } from '@/entities/report/types';

export const MonthlyClientReportTable: React.FC<{ months: MonthlyClientReportMonth[] }> = ({ months }) => {
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
          <Title order={3}>Отчет по месяцам</Title>
          <Text size="sm" c="dimmed">
            Клиенты отсортированы по убыванию общей суммы в выбранном месяце.
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
                      Работ: {month.totalWorks}
                    </Badge>
                    <Badge variant="light" color="orange">
                      Сумма: {formatAmount(month.totalAmount)} ₽
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
                          <Table.Th>Клиент</Table.Th>
                          <Table.Th>Количество работ</Table.Th>
                          <Table.Th>Общая стоимость</Table.Th>
                          <Table.Th>Доля месяца</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {month.clients.map((client) => {
                          const share = month.totalAmount > 0 ? (client.totalAmount / month.totalAmount) * 100 : 0;

                          return (
                            <Table.Tr key={`${month.monthKey}-${client.clientId}`}>
                              <Table.Td>{client.clientName}</Table.Td>
                              <Table.Td>{client.worksCount}</Table.Td>
                              <Table.Td>{formatAmount(client.totalAmount)} ₽</Table.Td>
                              <Table.Td>{formatPercent(share)}%</Table.Td>
                            </Table.Tr>
                          );
                        })}
                        <Table.Tr>
                          <Table.Td>
                            <Text fw={700}>Итого за месяц</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text fw={700}>{month.totalWorks}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text fw={700}>{formatAmount(month.totalAmount)} ₽</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text fw={700}>100,0%</Text>
                          </Table.Td>
                        </Table.Tr>
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                  <Text size="sm" c="dimmed">
                    Общая сумма за {month.monthLabel.toLowerCase()}: {formatAmount(month.totalAmount)} ₽
                  </Text>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </Stack>
    </Paper>
  );
};
