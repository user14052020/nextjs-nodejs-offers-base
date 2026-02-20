'use client';

import React from 'react';

import { getToken } from '@/shared/lib/auth';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const token = getToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="container" style={{ padding: 40 }}>Проверяем доступ...</div>;
  }

  return <>{children}</>;
};
