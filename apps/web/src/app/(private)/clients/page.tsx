'use client';

import React from 'react';
import { Alert, Button, Group, Paper, Stack, TextInput } from '@mantine/core';

import { fetchClients } from '@/entities/client/api';
import { Client } from '@/entities/client/types';
import { ClientForm } from '@/features/client/ClientForm';
import { ClientsTable } from '@/widgets/client/ClientsTable';

export default function ClientsPage() {
  const [items, setItems] = React.useState<Client[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [editingItem, setEditingItem] = React.useState<Client | null>(null);
  const [query, setQuery] = React.useState('');
  const [activeQuery, setActiveQuery] = React.useState('');

  const load = React.useCallback(async (search?: string) => {
    try {
      setError(null);
      const data = await fetchClients(search);
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
              placeholder="Поиск по клиентам: название, ИНН, КПП, банк, счет, адрес..."
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
      <ClientForm onSaved={handleSaved} editingItem={editingItem} onCancelEdit={() => setEditingItem(null)} />
      {error && <Alert color="red">{error}</Alert>}
      <ClientsTable items={items} onChange={() => load(activeQuery)} onEdit={setEditingItem} />
    </Stack>
  );
}
