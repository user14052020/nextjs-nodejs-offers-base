'use client';

import React from 'react';
import { Button, Group, Paper, Select, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';

import { Client } from '@/entities/client/types';
import { createWork, updateWork } from '@/entities/work/api';
import { Work } from '@/entities/work/types';
import { Organization } from '@/entities/organization/types';
import { Field } from '@/shared/ui/Field';

type WorkItemForm = {
  name: string;
  quantity: string;
  price: string;
};

const emptyItem = (): WorkItemForm => ({
  name: '',
  quantity: '1',
  price: ''
});

const formatAmount = (value: number) =>
  value.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const parsePositiveNumber = (value: string) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const itemAmount = (item: WorkItemForm) => {
  const quantity = parsePositiveNumber(item.quantity);
  const price = parsePositiveNumber(item.price);
  return quantity * price;
};

const normalizeItemFromWork = (work: Work): WorkItemForm[] => {
  if (Array.isArray(work.items) && work.items.length) {
    return work.items.map((item) => ({
      name: item.name || '',
      quantity: String(item.quantity ?? 1),
      price: String(item.price ?? 0)
    }));
  }
  return [emptyItem()];
};

const toDateInputValue = (value?: string) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
};

const todayDateInputValue = () => new Date().toISOString().slice(0, 10);

export const WorkForm: React.FC<{
  organizations: Organization[];
  clients: Client[];
  onSaved: () => void;
  editingItem: Work | null;
  onCancelEdit: () => void;
}> = ({ organizations, clients, onSaved, editingItem, onCancelEdit }) => {
  const [form, setForm] = React.useState({
    items: [emptyItem()],
    currency: 'RUB',
    executorOrganizationId: '',
    clientId: '',
    actNumber: '',
    invoiceNumber: '',
    documentDate: todayDateInputValue()
  });
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!editingItem) {
      setForm({
        items: [emptyItem()],
        currency: 'RUB',
        executorOrganizationId: '',
        clientId: '',
        actNumber: '',
        invoiceNumber: '',
        documentDate: todayDateInputValue()
      });
      return;
    }

    const hasOrganization = organizations.some((org) => org._id === editingItem.executorOrganizationId);
    const hasClient = clients.some((client) => client._id === editingItem.clientId);

    setForm({
      items: normalizeItemFromWork(editingItem),
      currency: editingItem.currency || 'RUB',
      executorOrganizationId: hasOrganization ? editingItem.executorOrganizationId : '',
      clientId: hasClient ? editingItem.clientId : '',
      actNumber: editingItem.actNumber || '',
      invoiceNumber: editingItem.invoiceNumber || '',
      documentDate:
        toDateInputValue(editingItem.actDate) || toDateInputValue(editingItem.invoiceDate) || todayDateInputValue()
    });
  }, [editingItem, organizations, clients]);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleItemChange = (index: number, key: keyof WorkItemForm, value: string) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item))
    }));
  };

  const handleAddItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, emptyItem()]
    }));
  };

  const handleRemoveItem = (index: number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index)
    }));
  };

  const payloadItems = React.useMemo(
    () =>
      form.items
        .map((item) => ({
          name: item.name.trim(),
          quantity: parsePositiveNumber(item.quantity),
          price: parsePositiveNumber(item.price)
        }))
        .filter((item) => item.name.length > 0 && item.quantity > 0 && item.price >= 0),
    [form.items]
  );

  const totalAmount = React.useMemo(
    () => payloadItems.reduce((sum, item) => sum + item.quantity * item.price, 0),
    [payloadItems]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!payloadItems.length) {
      return;
    }

    setLoading(true);
    const payload = {
      items: payloadItems,
      currency: form.currency,
      executorOrganizationId: form.executorOrganizationId,
      clientId: form.clientId,
      actNumber: form.actNumber || undefined,
      invoiceNumber: form.invoiceNumber || undefined,
      actDate: form.documentDate || undefined,
      invoiceDate: form.documentDate || undefined
    };
    if (editingItem) {
      await updateWork(editingItem._id, payload);
    } else {
      await createWork(payload);
    }
    setLoading(false);
    setForm({
      items: [emptyItem()],
      currency: 'RUB',
      executorOrganizationId: '',
      clientId: '',
      actNumber: '',
      invoiceNumber: '',
      documentDate: todayDateInputValue()
    });
    onSaved();
  };

  const organizationOptions = organizations.map((org) => ({ value: org._id, label: org.name }));
  const clientOptions = clients.map((client) => ({ value: client._id, label: client.name }));

  return (
    <Paper withBorder shadow="sm" radius="lg" p="xl" component="form" onSubmit={handleSubmit}>
      <Stack gap="md">
        <div>
          <Title order={2}>{editingItem ? 'Редактирование работы' : 'Новая работа'}</Title>
          <Text size="sm" c="dimmed">
            Добавьте позиции работ. Номер акта/счета можно задать вручную или оставить пустым для автонумерации по
            текущему году.
          </Text>
        </div>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Field label="Организация">
            <Select
              placeholder="Выберите организацию"
              value={form.executorOrganizationId || null}
              data={organizationOptions}
              onChange={(value) => handleChange('executorOrganizationId', value || '')}
              searchable
            />
          </Field>
          <Field label="Клиент">
            <Select
              placeholder="Выберите клиента"
              value={form.clientId || null}
              data={clientOptions}
              onChange={(value) => handleChange('clientId', value || '')}
              searchable
            />
          </Field>
          <Field label="Номер акта (опционально)">
            <TextInput value={form.actNumber} onChange={(event) => handleChange('actNumber', event.currentTarget.value)} />
          </Field>
          <Field label="Номер счета (опционально)">
            <TextInput
              value={form.invoiceNumber}
              onChange={(event) => handleChange('invoiceNumber', event.currentTarget.value)}
            />
          </Field>
          <Field label="Дата документа">
            <TextInput
              type="date"
              value={form.documentDate}
              onChange={(event) => handleChange('documentDate', event.currentTarget.value)}
            />
          </Field>
        </SimpleGrid>

        <Stack gap="sm">
          <Group justify="space-between">
            <Title order={3}>Позиции работ</Title>
            <Button variant="light" color="gray" type="button" onClick={handleAddItem}>
              Добавить позицию
            </Button>
          </Group>

          {form.items.map((item, index) => (
            <Paper key={index} withBorder p="md" radius="md">
              <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="sm">
                <Field label="Наименование">
                  <TextInput value={item.name} onChange={(event) => handleItemChange(index, 'name', event.currentTarget.value)} />
                </Field>
                <Field label="Кол-во">
                  <TextInput
                    type="number"
                    min="0"
                    step="0.001"
                    value={item.quantity}
                    onChange={(event) => handleItemChange(index, 'quantity', event.currentTarget.value)}
                  />
                </Field>
                <Field label="Цена">
                  <TextInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price}
                    onChange={(event) => handleItemChange(index, 'price', event.currentTarget.value)}
                  />
                </Field>
                <Field label="Сумма">
                  <TextInput value={formatAmount(itemAmount(item))} readOnly />
                </Field>
                <Field label="Действие">
                  <Button
                    variant="light"
                    color="red"
                    type="button"
                    disabled={form.items.length === 1}
                    onClick={() => handleRemoveItem(index)}
                  >
                    Удалить
                  </Button>
                </Field>
              </SimpleGrid>
            </Paper>
          ))}

          <Text size="sm" c="dimmed">
            Итого по позициям: {formatAmount(totalAmount)} RUB
          </Text>
        </Stack>

        <Group>
          <Button
            type="submit"
            loading={loading}
            disabled={!form.executorOrganizationId || !form.clientId || payloadItems.length === 0}
          >
            {editingItem ? 'Сохранить изменения' : 'Создать'}
          </Button>
          {editingItem && (
            <Button variant="light" color="gray" type="button" onClick={onCancelEdit}>
              Отмена
            </Button>
          )}
        </Group>
      </Stack>
    </Paper>
  );
};
