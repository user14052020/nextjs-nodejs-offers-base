'use client';

import React from 'react';

import { fetchClients } from '@/entities/client/api';
import { Client } from '@/entities/client/types';
import { fetchOrganizations } from '@/entities/organization/api';
import { Organization } from '@/entities/organization/types';
import { fetchWorks } from '@/entities/work/api';
import { Work } from '@/entities/work/types';
import { WorkForm } from '@/features/work/WorkForm';
import { WorksTable } from '@/widgets/work/WorksTable';

export default function WorksPage() {
  const [works, setWorks] = React.useState<Work[]>([]);
  const [organizations, setOrganizations] = React.useState<Organization[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [editingItem, setEditingItem] = React.useState<Work | null>(null);
  const [query, setQuery] = React.useState('');
  const [activeQuery, setActiveQuery] = React.useState('');

  const load = React.useCallback(async (search?: string) => {
    try {
      setError(null);
      const [worksData, orgsData, clientsData] = await Promise.all([
        fetchWorks(search),
        fetchOrganizations(),
        fetchClients()
      ]);
      setWorks(worksData);
      setOrganizations(orgsData);
      setClients(clientsData);
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
            placeholder="Поиск работ: номер акта/счета, содержимое позиций..."
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
      <WorkForm
        organizations={organizations}
        clients={clients}
        onSaved={handleSaved}
        editingItem={editingItem}
        onCancelEdit={() => setEditingItem(null)}
      />
      {error && <div className="card">{error}</div>}
      <WorksTable
        items={works}
        organizations={organizations}
        clients={clients}
        onChange={() => load(activeQuery)}
        onEdit={setEditingItem}
      />
    </div>
  );
}
