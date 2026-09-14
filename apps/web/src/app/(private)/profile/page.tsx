import { Stack } from '@mantine/core';

import { ChangePasswordForm } from '@/features/auth/ChangePasswordForm';

export default function ProfilePage() {
  return (
    <Stack gap="xl">
      <ChangePasswordForm />
    </Stack>
  );
}
