import Link from 'next/link';
import { Button, Container, Paper, Stack, Text, Title } from '@mantine/core';

export default function HomePage() {
  return (
    <Container size="md" py={56}>
      <Paper withBorder shadow="sm" radius="lg" p="xl">
        <Stack gap="md">
          <Title order={1}>Offers Base</Title>
          <Text c="dimmed">
            Минимальный кабинет ИП: организации, клиенты, выполненные работы и PDF‑документы.
          </Text>
          <Button component={Link} href="/login" w="fit-content">
            Перейти к входу
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
