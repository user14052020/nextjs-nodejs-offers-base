'use client';

import React from 'react';
import { Alert, Button, Checkbox, Group, Paper, Select, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';

import { createIncome, updateIncome } from '@/entities/income/api';
import {
  Income,
  IncomeConfirmationDocumentType,
  IncomePaymentMethod,
  IncomeSource
} from '@/entities/income/types';
import { Field } from '@/shared/ui/Field';

type IncomeFormState = {
  source: IncomeSource;
  sourceName: string;
  incomeDate: string;
  customerName: string;
  description: string;
  orderTitle: string;
  grossAmount: string;
  netAmount: string;
  platformCommission: string;
  payoutCommission: string;
  currency: string;
  paymentMethod: IncomePaymentMethod;
  confirmationDocumentType: IncomeConfirmationDocumentType;
  settlementPlace: string;
  receiptNumber: string;
  receiptDate: string;
  isReceived: boolean;
};

const todayDateInputValue = () => new Date().toISOString().slice(0, 10);

const toDateInputValue = (value?: string) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const toAmountInput = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '';
  }
  return String(value);
};

const parseAmount = (value: string) => {
  const amount = Number(value.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
};

const createEmptyForm = (): IncomeFormState => ({
  source: 'manual',
  sourceName: 'Прямая оплата',
  incomeDate: todayDateInputValue(),
  customerName: '',
  description: '',
  orderTitle: '',
  grossAmount: '',
  netAmount: '',
  platformCommission: '',
  payoutCommission: '0',
  currency: 'RUB',
  paymentMethod: 'card_transfer',
  confirmationDocumentType: 'receipt',
  settlementPlace: 'дистанционный расчет',
  receiptNumber: '',
  receiptDate: todayDateInputValue(),
  isReceived: true
});

const formFromIncome = (income: Income): IncomeFormState => ({
  source: income.source,
  sourceName: income.sourceName || (income.source === 'kwork' ? 'Kwork' : 'Прямая оплата'),
  incomeDate: toDateInputValue(income.incomeDate) || todayDateInputValue(),
  customerName: income.customerName || '',
  description: income.description || '',
  orderTitle: income.orderTitle || '',
  grossAmount: toAmountInput(income.grossAmount),
  netAmount: toAmountInput(income.netAmount),
  platformCommission: toAmountInput(income.platformCommission),
  payoutCommission: toAmountInput(income.payoutCommission),
  currency: income.currency || 'RUB',
  paymentMethod: income.paymentMethod || (income.source === 'kwork' ? 'platform' : 'card_transfer'),
  confirmationDocumentType:
    income.confirmationDocumentType || (income.source === 'kwork' ? 'platform_report' : 'receipt'),
  settlementPlace: income.settlementPlace || 'дистанционный расчет',
  receiptNumber: income.receiptNumber || '',
  receiptDate: toDateInputValue(income.receiptDate) || toDateInputValue(income.incomeDate) || todayDateInputValue(),
  isReceived: Boolean(income.isReceived)
});

export const IncomeForm: React.FC<{
  onSaved: () => void | Promise<void>;
  editingItem: Income | null;
  onCancelEdit: () => void;
}> = ({ onSaved, editingItem, onCancelEdit }) => {
  const [form, setForm] = React.useState<IncomeFormState>(createEmptyForm);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setForm(editingItem ? formFromIncome(editingItem) : createEmptyForm());
    setError(null);
  }, [editingItem]);

  const handleChange = (key: keyof IncomeFormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSourceChange = (source: IncomeSource) => {
    setForm((prev) => ({
      ...prev,
      source,
      sourceName: source === 'kwork' ? 'Kwork' : 'Прямая оплата',
      paymentMethod: source === 'kwork' ? 'platform' : 'card_transfer',
      confirmationDocumentType: source === 'kwork' ? 'platform_report' : 'receipt',
      receiptDate: source === 'kwork' ? prev.receiptDate : prev.receiptDate || prev.incomeDate,
      settlementPlace: source === 'kwork' ? prev.settlementPlace : prev.settlementPlace || 'дистанционный расчет'
    }));
  };

  const handleCancel = () => {
    setForm(createEmptyForm());
    setError(null);
    onCancelEdit();
  };

  const handleSubmit = async () => {
    const grossAmount = parseAmount(form.grossAmount);
    const netAmount = parseAmount(form.netAmount || form.grossAmount);
    const platformCommission =
      form.platformCommission.trim() === ''
        ? Math.max(0, grossAmount - netAmount)
        : parseAmount(form.platformCommission);
    const payoutCommission = parseAmount(form.payoutCommission);

    if (!form.sourceName.trim()) {
      setError('Укажите источник');
      return;
    }
    if (!form.description.trim()) {
      setError('Укажите описание дохода');
      return;
    }
    if (grossAmount <= 0) {
      setError('Укажите валовую сумму дохода');
      return;
    }
    if (netAmount <= 0) {
      setError('Укажите сумму зачисления');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        source: form.source,
        sourceName: form.sourceName.trim(),
        incomeDate: form.incomeDate,
        description: form.description.trim(),
        customerName: form.customerName.trim() || undefined,
        orderTitle: form.orderTitle.trim() || form.description.trim(),
        grossAmount,
        netAmount,
        platformCommission,
        payoutCommission,
        currency: form.currency.trim() || 'RUB',
        isReceived: form.isReceived,
        paymentMethod: form.paymentMethod,
        confirmationDocumentType: form.confirmationDocumentType,
        receiptNumber: form.confirmationDocumentType === 'receipt' ? form.receiptNumber.trim() || undefined : undefined,
        receiptDate: form.confirmationDocumentType === 'receipt' ? form.receiptDate || form.incomeDate : undefined,
        settlementPlace:
          form.confirmationDocumentType === 'receipt'
            ? form.settlementPlace.trim() || 'дистанционный расчет'
            : undefined,
        taxRegime: 'ПСН',
        cashRegisterExemptionReason: 'ККТ не применяется: ПСН, п. 2.1 ст. 2 54-ФЗ'
      };

      if (editingItem) {
        await updateIncome(editingItem._id, payload);
      } else {
        await createIncome(payload);
      }

      setForm(createEmptyForm());
      onCancelEdit();
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить доход');
    } finally {
      setLoading(false);
    }
  };

  const isReceipt = form.confirmationDocumentType === 'receipt';

  return (
    <Paper withBorder shadow="sm" radius="lg" p="xl">
      <Stack gap="md">
        <div>
          <Title order={2}>{editingItem ? 'Редактирование дохода' : 'Доход'}</Title>
          <Text c="dimmed" size="sm">
            Одна форма для прямых оплат и Kwork. Счета и акты не создаются.
          </Text>
        </div>

        {error && <Alert color="red">{error}</Alert>}

        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Field label="Тип дохода">
            <Select
              value={form.source}
              onChange={(value) => handleSourceChange((value as IncomeSource) || 'manual')}
              data={[
                { value: 'manual', label: 'Прямая оплата' },
                { value: 'kwork', label: 'Kwork' }
              ]}
            />
          </Field>
          <Field label="Источник">
            <TextInput value={form.sourceName} onChange={(event) => handleChange('sourceName', event.currentTarget.value)} />
          </Field>
          <Field label="Дата дохода">
            <TextInput
              type="date"
              value={form.incomeDate}
              onChange={(event) => handleChange('incomeDate', event.currentTarget.value)}
            />
          </Field>
          <Field label="Покупатель">
            <TextInput
              value={form.customerName}
              onChange={(event) => handleChange('customerName', event.currentTarget.value)}
            />
          </Field>
          <Field label="Описание">
            <TextInput
              value={form.description}
              onChange={(event) => handleChange('description', event.currentTarget.value)}
            />
          </Field>
          <Field label="Заказ / услуга">
            <TextInput
              value={form.orderTitle}
              onChange={(event) => handleChange('orderTitle', event.currentTarget.value)}
            />
          </Field>
          <Field label="Валовый доход">
            <TextInput
              value={form.grossAmount}
              onChange={(event) => handleChange('grossAmount', event.currentTarget.value)}
            />
          </Field>
          <Field label="Зачислено">
            <TextInput value={form.netAmount} onChange={(event) => handleChange('netAmount', event.currentTarget.value)} />
          </Field>
          <Field label="Комиссия площадки">
            <TextInput
              placeholder="автоматически"
              value={form.platformCommission}
              onChange={(event) => handleChange('platformCommission', event.currentTarget.value)}
            />
          </Field>
          <Field label="Комиссия вывода">
            <TextInput
              value={form.payoutCommission}
              onChange={(event) => handleChange('payoutCommission', event.currentTarget.value)}
            />
          </Field>
          <Field label="Способ оплаты">
            <Select
              value={form.paymentMethod}
              onChange={(value) => handleChange('paymentMethod', (value as IncomePaymentMethod) || 'card_transfer')}
              data={[
                { value: 'platform', label: 'Площадка' },
                { value: 'card_transfer', label: 'Перевод на карту' },
                { value: 'cash', label: 'Наличные' },
                { value: 'bank_account', label: 'Расчетный счет' },
                { value: 'other', label: 'Другое' }
              ]}
            />
          </Field>
          <Field label="Подтверждение">
            <Select
              value={form.confirmationDocumentType}
              onChange={(value) =>
                handleChange('confirmationDocumentType', (value as IncomeConfirmationDocumentType) || 'none')
              }
              data={[
                { value: 'receipt', label: 'Квитанция' },
                { value: 'platform_report', label: 'Отчет площадки' },
                { value: 'none', label: 'Без документа' }
              ]}
            />
          </Field>
          {isReceipt && (
            <>
              <Field label="Место расчета">
                <TextInput
                  value={form.settlementPlace}
                  onChange={(event) => handleChange('settlementPlace', event.currentTarget.value)}
                />
              </Field>
              <Field label="Дата квитанции">
                <TextInput
                  type="date"
                  value={form.receiptDate}
                  onChange={(event) => handleChange('receiptDate', event.currentTarget.value)}
                />
              </Field>
              <Field label="Номер квитанции">
                <TextInput
                  placeholder="автоматически"
                  value={form.receiptNumber}
                  onChange={(event) => handleChange('receiptNumber', event.currentTarget.value)}
                />
              </Field>
            </>
          )}
        </SimpleGrid>

        <Checkbox
          label="Доход получен"
          checked={form.isReceived}
          onChange={(event) => handleChange('isReceived', event.currentTarget.checked)}
        />

        <Group>
          <Button variant="light" color="gray" loading={loading} onClick={handleSubmit}>
            {editingItem ? 'Сохранить изменения' : 'Сохранить доход'}
          </Button>
          {editingItem && (
            <Button variant="subtle" color="gray" disabled={loading} onClick={handleCancel}>
              Отмена
            </Button>
          )}
        </Group>
      </Stack>
    </Paper>
  );
};
