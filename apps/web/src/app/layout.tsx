import type { Metadata } from 'next';
import { ColorSchemeScript } from '@mantine/core';
import '@mantine/core/styles.css';

import { AppProviders } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Offers Base',
  description: 'Учет ИП: организации, клиенты, работы'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
