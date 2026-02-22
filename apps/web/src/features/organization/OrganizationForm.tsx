'use client';

import React from 'react';
import { Button, Group, Paper, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';

import { createOrganization, updateOrganization } from '@/entities/organization/api';
import { Organization } from '@/entities/organization/types';
import { stripEmpty } from '@/shared/lib/stripEmpty';
import { Field } from '@/shared/ui/Field';

const EMPTY_FORM = {
  name: '',
  shortName: '',
  inn: '',
  kpp: '',
  bankAccount: '',
  bankName: '',
  bik: '',
  correspondentAccount: '',
  address: '',
  email: '',
  phone: '',
  signerName: '',
  chiefAccountant: ''
};

export const OrganizationForm: React.FC<{
  onSaved: () => void;
  editingItem: Organization | null;
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
      shortName: editingItem.shortName || '',
      inn: editingItem.inn || '',
      kpp: editingItem.kpp || '',
      bankAccount: editingItem.bankAccount || '',
      bankName: editingItem.bankName || '',
      bik: editingItem.bik || '',
      correspondentAccount: editingItem.correspondentAccount || '',
      address: editingItem.address || '',
      email: editingItem.email || '',
      phone: editingItem.phone || '',
      signerName: editingItem.signerName || '',
      chiefAccountant: editingItem.chiefAccountant || ''
    });
  }, [editingItem]);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    if (editingItem) {
      await updateOrganization(editingItem._id, stripEmpty({ ...form }));
    } else {
      await createOrganization(stripEmpty({ ...form }));
    }
    setLoading(false);
    setForm({ ...EMPTY_FORM });
    onSaved();
  };

  return (
    <Paper withBorder shadow="sm" radius="lg" p="xl" component="form" onSubmit={handleSubmit}>
      <Stack gap="md">
        <div>
          <Title order={2}>{editingItem ? 'Редактирование организации' : 'Организация'}</Title>
          <Text size="sm" c="dimmed">
            Данные вашей организации и банковские реквизиты.
          </Text>
        </div>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Field label="Название">
            <TextInput value={form.name} onChange={(event) => handleChange('name', event.currentTarget.value)} />
          </Field>
          <Field label="Короткое имя (для шапки счета)">
            <TextInput
              value={form.shortName}
              onChange={(event) => handleChange('shortName', event.currentTarget.value)}
            />
          </Field>
          <Field label="ИНН">
            <TextInput value={form.inn} onChange={(event) => handleChange('inn', event.currentTarget.value)} />
          </Field>
          <Field label="КПП">
            <TextInput value={form.kpp} onChange={(event) => handleChange('kpp', event.currentTarget.value)} />
          </Field>
          <Field label="Расчетный счет">
            <TextInput
              value={form.bankAccount}
              onChange={(event) => handleChange('bankAccount', event.currentTarget.value)}
            />
          </Field>
          <Field label="Банк">
            <TextInput value={form.bankName} onChange={(event) => handleChange('bankName', event.currentTarget.value)} />
          </Field>
          <Field label="БИК">
            <TextInput value={form.bik} onChange={(event) => handleChange('bik', event.currentTarget.value)} />
          </Field>
          <Field label="Корр. счет">
            <TextInput
              value={form.correspondentAccount}
              onChange={(event) => handleChange('correspondentAccount', event.currentTarget.value)}
            />
          </Field>
          <Field label="Адрес">
            <TextInput value={form.address} onChange={(event) => handleChange('address', event.currentTarget.value)} />
          </Field>
          <Field label="Email">
            <TextInput value={form.email} onChange={(event) => handleChange('email', event.currentTarget.value)} />
          </Field>
          <Field label="Телефон">
            <TextInput value={form.phone} onChange={(event) => handleChange('phone', event.currentTarget.value)} />
          </Field>
          <Field label="Руководитель (подпись)">
            <TextInput
              value={form.signerName}
              onChange={(event) => handleChange('signerName', event.currentTarget.value)}
            />
          </Field>
          <Field label="Главный бухгалтер (подпись)">
            <TextInput
              value={form.chiefAccountant}
              onChange={(event) => handleChange('chiefAccountant', event.currentTarget.value)}
            />
          </Field>
        </SimpleGrid>

        <Group>
          <Button type="submit" loading={loading} disabled={!form.name}>
            {editingItem ? 'Сохранить изменения' : 'Сохранить'}
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
