'use client';

import React from 'react';
import { Alert, Loader, Paper, Stack, Text, Title } from '@mantine/core';

import { fetchMonthlyClientReport } from '@/entities/report/api';
import { MonthlyClientReportMonth } from '@/entities/report/types';
import { MonthlyClientReportTable } from '@/widgets/report/MonthlyClientReportTable';

export default function ReportPage() {
  const [months, setMonths] = React.useState<MonthlyClientReportMonth[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      const reportData = await fetchMonthlyClientReport();
      setMonths(reportData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки отчета');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <Stack gap="xl">
      <Paper withBorder shadow="sm" radius="lg" p="xl">
        <Stack gap={4}>
          <Title order={2}>Отчет</Title>
          <Text size="sm" c="dimmed">
            Аналитика по месяцам: количество работ и общая стоимость по клиентам с сортировкой по убыванию суммы.
          </Text>
        </Stack>
      </Paper>

      {isLoading && (
        <Paper withBorder shadow="sm" radius="lg" p="xl">
          <Loader size="sm" />
        </Paper>
      )}

      {error && <Alert color="red">{error}</Alert>}
      {!isLoading && !error && <MonthlyClientReportTable months={months} />}
    </Stack>
  );
}
