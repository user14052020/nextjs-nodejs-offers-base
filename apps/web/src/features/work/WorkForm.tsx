'use client';

import React from 'react';

import { createWork, updateWork } from '@/entities/work/api';
import { Work } from '@/entities/work/types';
import { Field } from '@/shared/ui/Field';
import { Client } from '@/entities/client/types';
import { Organization } from '@/entities/organization/types';

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
    invoiceNumber: ''
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
        invoiceNumber: ''
      });
      return;
    }

    setForm({
      items: normalizeItemFromWork(editingItem),
      currency: editingItem.currency || 'RUB',
      executorOrganizationId: editingItem.executorOrganizationId || '',
      clientId: editingItem.clientId || '',
      actNumber: editingItem.actNumber || '',
      invoiceNumber: editingItem.invoiceNumber || ''
    });
  }, [editingItem]);

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
      invoiceNumber: form.invoiceNumber || undefined
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
      invoiceNumber: ''
    });
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="card grid" style={{ gap: 16 }}>
      <div>
        <h2>{editingItem ? 'Редактирование работы' : 'Новая работа'}</h2>
        <p className="muted">
          Добавьте позиции работ. Номер акта/счета можно задать вручную или оставить пустым для автонумерации по текущему году.
        </p>
      </div>

      <div className="grid grid-2">
        <Field label="Организация">
          <select
            className="select"
            value={form.executorOrganizationId}
            onChange={(e) => handleChange('executorOrganizationId', e.target.value)}
          >
            <option value="">Выберите организацию</option>
            {organizations.map((org) => (
              <option key={org._id} value={org._id}>
                {org.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Клиент">
          <select className="select" value={form.clientId} onChange={(e) => handleChange('clientId', e.target.value)}>
            <option value="">Выберите клиента</option>
            {clients.map((client) => (
              <option key={client._id} value={client._id}>
                {client.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Номер акта (опционально)">
          <input className="input" value={form.actNumber} onChange={(e) => handleChange('actNumber', e.target.value)} />
        </Field>
        <Field label="Номер счета (опционально)">
          <input
            className="input"
            value={form.invoiceNumber}
            onChange={(e) => handleChange('invoiceNumber', e.target.value)}
          />
        </Field>
      </div>

      <div className="grid" style={{ gap: 8 }}>
        <div className="flex" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Позиции работ</h3>
          <button className="button secondary" type="button" onClick={handleAddItem}>
            Добавить позицию
          </button>
        </div>
        {form.items.map((item, index) => (
          <div
            key={index}
            className="grid"
            style={{ gap: 10, gridTemplateColumns: '2fr 0.7fr 0.9fr 0.9fr auto', alignItems: 'end' }}
          >
            <Field label="Наименование">
              <input
                className="input"
                value={item.name}
                onChange={(event) => handleItemChange(index, 'name', event.target.value)}
              />
            </Field>
            <Field label="Кол-во">
              <input
                className="input"
                type="number"
                min="0"
                step="0.001"
                value={item.quantity}
                onChange={(event) => handleItemChange(index, 'quantity', event.target.value)}
              />
            </Field>
            <Field label="Цена">
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={item.price}
                onChange={(event) => handleItemChange(index, 'price', event.target.value)}
              />
            </Field>
            <Field label="Сумма">
              <input className="input" value={formatAmount(itemAmount(item))} readOnly />
            </Field>
            <button
              className="button secondary"
              type="button"
              disabled={form.items.length === 1}
              onClick={() => handleRemoveItem(index)}
            >
              Удалить
            </button>
          </div>
        ))}
        <p className="muted" style={{ margin: 0 }}>
          Итого по позициям: {formatAmount(totalAmount)} RUB
        </p>
      </div>

      <div className="flex">
        <button
          className="button"
          type="submit"
          disabled={loading || !form.executorOrganizationId || !form.clientId || payloadItems.length === 0}
        >
          {loading ? 'Сохраняем...' : editingItem ? 'Сохранить изменения' : 'Создать'}
        </button>
        {editingItem && (
          <button className="button secondary" type="button" onClick={onCancelEdit}>
            Отмена
          </button>
        )}
      </div>
    </form>
  );
};
