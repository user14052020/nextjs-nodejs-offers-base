'use client';

import React from 'react';
import { Alert, Button, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';

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
    <Paper withBorder shadow="sm" radius="lg" p="xl" component="form" onSubmit={handleSubmit}>
      <Stack gap="md">
        <div>
          <Title order={2}>Вход</Title>
          <Text c="dimmed" size="sm">
            Используйте учетные данные администратора из `.env`.
          </Text>
        </div>

        <TextInput label="Логин" value={username} onChange={(event) => setUsername(event.currentTarget.value)} />

        <PasswordInput
          label="Пароль"
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
        />

        {error && <Alert color="red">{error}</Alert>}

        <Button type="submit" loading={loading} disabled={!username || !password}>
          Войти
        </Button>
      </Stack>
    </Paper>
  );
};
