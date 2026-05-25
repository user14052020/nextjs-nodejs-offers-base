'use client';

import React from 'react';
import { Alert, Badge, Group, Loader, Paper, Stack, Switch, Text, Title } from '@mantine/core';

import { fetchMonthlyClientReport } from '@/entities/report/api';
import { MonthlyClientReport } from '@/entities/report/types';
import { MonthlyClientReportTable } from '@/widgets/report/MonthlyClientReportTable';

export default function ReportPage() {
  const [report, setReport] = React.useState<MonthlyClientReport | null>(null);
  const [paidOnly, setPaidOnly] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const formatAmount = (value: number) =>
    value.toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  const load = React.useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      const reportData = await fetchMonthlyClientReport(paidOnly);
      setReport(reportData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки отчета');
    } finally {
      setIsLoading(false);
    }
  }, [paidOnly]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <Stack gap="xl">
      <Paper withBorder shadow="sm" radius="lg" p="xl">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <Stack gap={4}>
              <Title order={2}>Отчет</Title>
              <Text size="sm" c="dimmed">
                Аналитика по месяцам: количество работ, сумма документов и сумма зачислений по клиентам.
              </Text>
            </Stack>
            <Switch
              checked={paidOnly}
              color="dark"
              label="Только оплаченные"
              onChange={(event) => setPaidOnly(event.currentTarget.checked)}
            />
          </Group>

          {report && (
            <Group gap="xs" wrap="wrap">
              <Badge variant="light" color="gray">
                Работ: {report.summary.totalWorks}
              </Badge>
              <Badge variant="light" color="dark">
                Оплачено: {report.summary.paidWorksCount}
              </Badge>
              <Badge variant="light" color="gray">
                Документы: {formatAmount(report.summary.totalAmount)} ₽
              </Badge>
              <Badge variant="light" color="gray">
                Зачисления: {formatAmount(report.summary.totalCreditedAmount)} ₽
              </Badge>
            </Group>
          )}
        </Stack>
      </Paper>

      {isLoading && (
        <Paper withBorder shadow="sm" radius="lg" p="xl">
          <Loader size="sm" />
        </Paper>
      )}

      {error && <Alert color="red">{error}</Alert>}
      {!isLoading && !error && report && <MonthlyClientReportTable months={report.months} paidOnly={report.paidOnly} />}
    </Stack>
  );
}
