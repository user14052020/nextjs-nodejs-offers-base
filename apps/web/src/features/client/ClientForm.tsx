'use client';

import React from 'react';

import { createClient, updateClient } from '@/entities/client/api';
import { Client } from '@/entities/client/types';
import { Field } from '@/shared/ui/Field';
import { stripEmpty } from '@/shared/lib/stripEmpty';

const EMPTY_FORM = {
  name: '',
  inn: '',
  kpp: '',
  bankAccount: '',
  bankName: '',
  bik: '',
  correspondentAccount: '',
  address: '',
  email: '',
  phone: '',
  contract: '',
  signerName: ''
};

export const ClientForm: React.FC<{
  onSaved: () => void;
  editingItem: Client | null;
  onCancelEdit: () => void;
}> = ({ onSaved, editingItem, onCancelEdit }) => {
  const [form, setForm] = React.useState({
    ...EMPTY_FORM
  });
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!editingItem) {
      setForm({ ...EMPTY_FORM });
      return;
    }

    setForm({
      name: editingItem.name || '',
      inn: editingItem.inn || '',
      kpp: editingItem.kpp || '',
      bankAccount: editingItem.bankAccount || '',
      bankName: editingItem.bankName || '',
      bik: editingItem.bik || '',
      correspondentAccount: editingItem.correspondentAccount || '',
      address: editingItem.address || '',
      email: editingItem.email || '',
      phone: editingItem.phone || '',
      contract: editingItem.contract || '',
      signerName: editingItem.signerName || ''
    });
  }, [editingItem]);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    if (editingItem) {
      await updateClient(editingItem._id, stripEmpty({ ...form }));
    } else {
      await createClient(stripEmpty({ ...form }));
    }
    setLoading(false);
    setForm({ ...EMPTY_FORM });
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="card grid" style={{ gap: 16 }}>
      <div>
        <h2>{editingItem ? 'Редактирование клиента' : 'Клиент'}</h2>
        <p className="muted">Реквизиты клиента и контактные данные.</p>
      </div>

      <div className="grid grid-2">
        <Field label="Название">
          <input className="input" value={form.name} onChange={(e) => handleChange('name', e.target.value)} />
        </Field>
        <Field label="ИНН">
          <input className="input" value={form.inn} onChange={(e) => handleChange('inn', e.target.value)} />
        </Field>
        <Field label="КПП">
          <input className="input" value={form.kpp} onChange={(e) => handleChange('kpp', e.target.value)} />
        </Field>
        <Field label="Расчетный счет">
          <input
            className="input"
            value={form.bankAccount}
            onChange={(e) => handleChange('bankAccount', e.target.value)}
          />
        </Field>
        <Field label="Банк">
          <input className="input" value={form.bankName} onChange={(e) => handleChange('bankName', e.target.value)} />
        </Field>
        <Field label="БИК">
          <input className="input" value={form.bik} onChange={(e) => handleChange('bik', e.target.value)} />
        </Field>
        <Field label="Корр. счет">
          <input
            className="input"
            value={form.correspondentAccount}
            onChange={(e) => handleChange('correspondentAccount', e.target.value)}
          />
        </Field>
        <Field label="Адрес">
          <input className="input" value={form.address} onChange={(e) => handleChange('address', e.target.value)} />
        </Field>
        <Field label="Email">
          <input className="input" value={form.email} onChange={(e) => handleChange('email', e.target.value)} />
        </Field>
        <Field label="Телефон">
          <input className="input" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} />
        </Field>
        <Field label="Договор (для актов)">
          <input className="input" value={form.contract} onChange={(e) => handleChange('contract', e.target.value)} />
        </Field>
        <Field label="Подписант">
          <input
            className="input"
            value={form.signerName}
            onChange={(e) => handleChange('signerName', e.target.value)}
          />
        </Field>
      </div>

      <div className="flex">
        <button className="button" type="submit" disabled={loading || !form.name}>
          {loading ? 'Сохраняем...' : editingItem ? 'Сохранить изменения' : 'Сохранить'}
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
