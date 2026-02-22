import { Container } from '@mantine/core';

import { AuthGate } from '@/widgets/layout/AuthGate';
import { TopNav } from '@/widgets/layout/TopNav';

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <TopNav />
      <Container size="xl" py="xl">
        {children}
      </Container>
    </AuthGate>
  );
}
