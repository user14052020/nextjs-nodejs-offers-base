'use client';

import React from 'react';

import { deleteWork } from '@/entities/work/api';
import { actPdfUrl, invoicePdfUrl } from '@/entities/work/api';
import { Work } from '@/entities/work/types';
import { Client } from '@/entities/client/types';
import { Organization } from '@/entities/organization/types';
import { fetchBlob } from '@/shared/api/http';

export const WorksTable: React.FC<{
  items: Work[];
  clients: Client[];
  organizations: Organization[];
  onChange: () => void;
  onEdit: (work: Work) => void;
}> = ({ items, clients, organizations, onChange, onEdit }) => {
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const clientMap = React.useMemo(() => new Map(clients.map((c) => [c._id, c.name])), [clients]);
  const orgMap = React.useMemo(() => new Map(organizations.map((o) => [o._id, o.name])), [organizations]);
  const formatAmount = (value: number) =>
    value.toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  const getWorkItemsText = (work: Work) => {
    if (Array.isArray(work.items) && work.items.length) {
      return work.items.map((item) => item.name).join('; ');
    }
    return '—';
  };

  const handleDelete = async (id: string) => {
    setLoadingId(id);
    await deleteWork(id);
    setLoadingId(null);
    onChange();
  };

  const openPdf = async (url: string) => {
    try {
      setError(null);
      const blob = await fetchBlob(url);
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка печати PDF');
    }
  };

  const withCacheBust = (url: string) => {
    const delimiter = url.includes('?') ? '&' : '?';
    return `${url}${delimiter}v=${Date.now()}`;
  };

  return (
    <div className="card">
      <h3>Работы и документы</h3>
      <p className="muted">Кнопки печати открывают PDF в новой вкладке, где доступна печать и сохранение.</p>
      <table className="table">
        <thead>
          <tr>
            <th>Позиции</th>
            <th>Организация</th>
            <th>Клиент</th>
            <th>Акт</th>
            <th>Счет</th>
            <th>Сумма</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {items.map((work) => (
            <tr key={work._id}>
              <td>{getWorkItemsText(work)}</td>
              <td>{orgMap.get(work.executorOrganizationId) ?? '—'}</td>
              <td>{clientMap.get(work.clientId) ?? '—'}</td>
              <td>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => openPdf(withCacheBust(actPdfUrl(work._id)))}
                >
                  АКТ {work.actNumber}
                </button>
              </td>
              <td>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => openPdf(withCacheBust(invoicePdfUrl(work._id)))}
                >
                  СЧЕТ {work.invoiceNumber}
                </button>
              </td>
              <td>
                {formatAmount(work.amount)} {work.currency || 'RUB'}
              </td>
              <td>
                <div className="flex">
                  <button className="button secondary" type="button" onClick={() => onEdit(work)}>
                    Редактировать
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={loadingId === work._id}
                    onClick={() => handleDelete(work._id)}
                  >
                    Удалить
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {error && <p className="muted">{error}</p>}
      {items.length === 0 && <p className="muted">Пока нет работ.</p>}
    </div>
  );
};
