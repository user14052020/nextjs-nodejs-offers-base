'use client';

import React from 'react';

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
    <div className="grid" style={{ gap: 24 }}>
      <div className="card">
        <form
          className="flex"
          onSubmit={(event) => {
            event.preventDefault();
            setActiveQuery(query);
          }}
        >
          <input
            className="input"
            placeholder="Поиск по клиентам: название, ИНН, КПП, банк, счет, адрес..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="button" type="submit">
            Найти
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              setQuery('');
              setActiveQuery('');
            }}
          >
            Сброс
          </button>
        </form>
      </div>
      <ClientForm onSaved={handleSaved} editingItem={editingItem} onCancelEdit={() => setEditingItem(null)} />
      {error && <div className="card">{error}</div>}
      <ClientsTable items={items} onChange={() => load(activeQuery)} onEdit={setEditingItem} />
    </div>
  );
}
