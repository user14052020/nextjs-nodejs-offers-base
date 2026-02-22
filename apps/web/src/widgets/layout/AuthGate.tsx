'use client';

import React from 'react';
import { Center, Loader, Stack, Text } from '@mantine/core';

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
    return (
      <Center py={80}>
        <Stack align="center" gap="sm">
          <Loader size="sm" />
          <Text c="dimmed">Проверяем доступ...</Text>
        </Stack>
      </Center>
    );
  }

  return <>{children}</>;
};
