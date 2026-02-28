'use client';

import Link from 'next/link';
import React from 'react';
import { Badge, Button, Group, Paper, Text } from '@mantine/core';

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
    <Paper
      component="nav"
      radius={0}
      withBorder
      p="md"
      bg="rgba(255,255,255,0.86)"
      style={{ position: 'sticky', top: 0, zIndex: 20, backdropFilter: 'blur(8px)' }}
    >
      <Group justify="space-between" wrap="wrap" gap="md">
        <Group gap="xs">
          <Text fw={700}>Offers Base</Text>
          <Badge variant="light" color="orange">
            ИП бухгалтерия
          </Badge>
          {username && (
            <Badge variant="outline" color="gray">
              {username}
            </Badge>
          )}
          {role && (
            <Badge variant="outline" color="gray">
              {role}
            </Badge>
          )}
        </Group>

        <Group gap="sm" wrap="wrap">
          <Button component={Link} href="/organizations" variant="subtle" color="gray">
            Организация
          </Button>
          <Button component={Link} href="/clients" variant="subtle" color="gray">
            Клиенты
          </Button>
          <Button component={Link} href="/works" variant="subtle" color="gray">
            Работы
          </Button>
          <Button component={Link} href="/report" variant="subtle" color="gray">
            Отчет
          </Button>
          <Button component={Link} href="/profile" variant="subtle" color="gray">
            Профиль
          </Button>
          <Button
            variant="light"
            color="gray"
            type="button"
            onClick={() => {
              clearToken();
              window.location.href = '/login';
            }}
          >
            Выйти
          </Button>
        </Group>
      </Group>
    </Paper>
  );
};
