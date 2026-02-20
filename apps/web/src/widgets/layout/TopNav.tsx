'use client';

import Link from 'next/link';
import React from 'react';

import { clearToken, getUser } from '@/shared/lib/auth';

export const TopNav: React.FC = () => {
  const [username, setUsername] = React.useState<string>('');
  const [role, setRole] = React.useState<string>('');

  React.useEffect(() => {
    const user = getUser();
    setUsername(user?.username || '');
    setRole(user?.role || '');
  }, []);

  return (
    <nav className="nav">
      <div className="flex">
        <strong>Offers Base</strong>
        <span className="badge">ИП бухгалтерия</span>
        {username && <span className="badge">{username}</span>}
        {role && <span className="badge">{role}</span>}
      </div>
      <div className="nav-links">
        <Link href="/organizations">Организация</Link>
        <Link href="/clients">Клиенты</Link>
        <Link href="/works">Работы</Link>
        <Link href="/profile">Профиль</Link>
        <button
          className="button secondary"
          type="button"
          onClick={() => {
            clearToken();
            window.location.href = '/login';
          }}
        >
          Выйти
        </button>
      </div>
    </nav>
  );
};
