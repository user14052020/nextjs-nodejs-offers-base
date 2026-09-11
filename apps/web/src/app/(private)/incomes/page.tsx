'use client';

import React from 'react';
import { Alert, Stack } from '@mantine/core';

import { fetchIncomes } from '@/entities/income/api';
import { Income } from '@/entities/income/types';
import { IncomeBalanceImportForm } from '@/features/income/IncomeBalanceImportForm';
import { IncomeForm } from '@/features/income/IncomeForm';
import { IncomesTable } from '@/widgets/income/IncomesTable';

export default function IncomesPage() {
  const [incomes, setIncomes] = React.useState<Income[]>([]);
  const [editingIncome, setEditingIncome] = React.useState<Income | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setError(null);
      setIncomes(await fetchIncomes());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки доходов');
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <Stack gap="xl">
      <IncomeForm onSaved={load} editingItem={editingIncome} onCancelEdit={() => setEditingIncome(null)} />
      <IncomeBalanceImportForm onImported={load} />
      {error && <Alert color="red">{error}</Alert>}
      <IncomesTable items={incomes} onChange={load} onEdit={setEditingIncome} />
    </Stack>
  );
}
