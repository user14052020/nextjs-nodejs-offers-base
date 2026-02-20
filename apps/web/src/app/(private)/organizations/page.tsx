'use client';

import React from 'react';

import { fetchOrganizations } from '@/entities/organization/api';
import { Organization } from '@/entities/organization/types';
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
            placeholder="Поиск по организациям: название, ИНН, КПП, банк, счет, адрес..."
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
      <OrganizationForm onSaved={handleSaved} editingItem={editingItem} onCancelEdit={() => setEditingItem(null)} />
      {error && <div className="card">{error}</div>}
      <OrganizationsTable items={items} onChange={() => load(activeQuery)} onEdit={setEditingItem} />
    </div>
  );
}
