'use client';

import React from 'react';
import { apiFetch } from '@/shared/api/http';
import { setToken, setUser } from '@/shared/lib/auth';

export const LoginForm: React.FC = () => {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await apiFetch<{
        accessToken: string;
        user: { id: string; username: string; role: 'admin' | 'user' };
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      setToken(result.accessToken);
      setUser(result.user);
      window.location.href = '/organizations';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card grid" style={{ gap: 16 }}>
      <div>
        <h2>Вход</h2>
        <p className="muted">Используйте учетные данные администратора из `.env`.</p>
      </div>

      <label className="grid" style={{ gap: 6 }}>
        <span className="label">Логин</span>
        <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
      </label>

      <label className="grid" style={{ gap: 6 }}>
        <span className="label">Пароль</span>
        <input
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {error && <div className="badge" style={{ background: '#ffe2d9' }}>{error}</div>}

      <button className="button" type="submit" disabled={loading || !username || !password}>
        {loading ? 'Входим...' : 'Войти'}
      </button>
    </form>
  );
};
