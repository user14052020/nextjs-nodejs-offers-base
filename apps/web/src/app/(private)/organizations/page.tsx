'use client';

import React from 'react';
import { Alert, Button, Group, Paper, Stack, TextInput } from '@mantine/core';

import { fetchOrganizations } from '@/entities/organization/api';
import { Organization } from '@/entities/organization/types';
import { CreateItemSection } from '@/features/create-item/CreateItemSection';
import { OrganizationForm } from '@/features/organization/OrganizationForm';
import { OrganizationsTable } from '@/widgets/organization/OrganizationsTable';

export default function OrganizationsPage() {
  const [items, setItems] = React.useState<Organization[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [editingItem, setEditingItem] = React.useState<Organization | null>(null);
  const [query, setQuery] = React.useState('');
  const [activeQuery, setActiveQuery] = React.useState('');

  const load = React.useCallback(async (search?: string) => {
    try {
      setError(null);
      const data = await fetchOrganizations(search);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    }
  }, []);

  React.useEffect(() => {
    load(activeQuery);
  }, [load, activeQuery]);

  const handleSaved = React.useCallback(async () => {
    setEditingItem(null);
    await load(activeQuery);
  }, [load, activeQuery]);

  return (
    <Stack gap="xl">
      <Paper withBorder shadow="sm" radius="lg" p="lg">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setActiveQuery(query);
          }}
        >
          <Group align="end" wrap="wrap">
            <TextInput
              style={{ flex: 1, minWidth: 260 }}
              placeholder="Поиск по организациям: название, ИНН, КПП, банк, счет, адрес..."
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
            <Button type="submit">Найти</Button>
            <Button
              variant="light"
              color="gray"
              type="button"
              onClick={() => {
                setQuery('');
                setActiveQuery('');
              }}
            >
              Сброс
            </Button>
          </Group>
        </form>
      </Paper>
      <CreateItemSection createLabel="Новая организация" isEditing={Boolean(editingItem)}>
        <OrganizationForm onSaved={handleSaved} editingItem={editingItem} onCancelEdit={() => setEditingItem(null)} />
      </CreateItemSection>
      {error && <Alert color="red">{error}</Alert>}
      <OrganizationsTable items={items} onChange={() => load(activeQuery)} onEdit={setEditingItem} />
    </Stack>
  );
}
