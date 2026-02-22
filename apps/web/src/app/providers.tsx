'use client';

import React from 'react';
import { MantineProvider } from '@mantine/core';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider
      defaultColorScheme="light"
      theme={{
        fontFamily: 'Space Grotesk, sans-serif',
        defaultRadius: 'md',
        primaryColor: 'orange'
      }}
    >
      {children}
    </MantineProvider>
  );
}
