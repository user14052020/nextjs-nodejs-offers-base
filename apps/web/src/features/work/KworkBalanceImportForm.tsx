'use client';

import React from 'react';
import { Alert, Button, FileInput, Group, List, Paper, Stack, Text, Title } from '@mantine/core';

import { importKworkBalanceReport } from '@/entities/work/api';
import { BalanceReportImportResult } from '@/entities/work/types';

export const KworkBalanceImportForm: React.FC<{ onImported?: () => void | Promise<void> }> = ({ onImported }) => {
  const [file, setFile] = React.useState<File | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<BalanceReportImportResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async () => {
    if (!file) {
      setError('Выберите XLSX файл');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const importResult = await importKworkBalanceReport(file);
      setResult(importResult);
      setFile(null);
      await onImported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось импортировать работы Kwork');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper withBorder shadow="sm" radius="lg" p="xl">
      <Stack gap="md" maw={720}>
        <div>
          <Title order={2}>Импорт работ Kwork</Title>
          <Text c="dimmed" size="sm">
            XLSX отчет баланса создает оплаченные работы. Сумма чека становится суммой документа, а сумма зачисления
            сохраняется отдельно.
          </Text>
        </div>

        <FileInput
          label="Файл отчета"
          placeholder="Выберите balance_report.xlsx"
          value={file}
          onChange={setFile}
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        />

        {error && <Alert color="red">{error}</Alert>}
        {result && (
          <Alert color="gray" title="Импорт завершен">
            <Stack gap="xs">
              <Text size="sm">
                Строк всего: {result.totalRows}. Распознано: {result.parsedRows}. Создано: {result.importedRows}.
                Дубликатов: {result.skippedDuplicates}. Пропущено: {result.skippedRows}.
              </Text>
              {result.warnings.length > 0 && (
                <List size="sm" spacing={4}>
                  {result.warnings.slice(0, 8).map((warning, index) => (
                    <List.Item key={`${warning.sheetName}-${warning.rowNumber}-${index}`}>
                      {warning.sheetName}
                      {warning.rowNumber > 0 ? `, строка ${warning.rowNumber}` : ''}: {warning.message}
                    </List.Item>
                  ))}
                  {result.warnings.length > 8 && <List.Item>Еще предупреждений: {result.warnings.length - 8}</List.Item>}
                </List>
              )}
            </Stack>
          </Alert>
        )}

        <Group>
          <Button variant="light" color="gray" loading={loading} disabled={!file} onClick={handleSubmit}>
            Импортировать работы
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
};
