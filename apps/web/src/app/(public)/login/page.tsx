import { Container } from '@mantine/core';

import { LoginForm } from '@/features/auth/LoginForm';

export default function LoginPage() {
  return (
    <Container size={420} py={56}>
      <LoginForm />
    </Container>
  );
}
