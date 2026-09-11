import { Stack } from '@mantine/core';

import { ChangePasswordForm } from '@/features/auth/ChangePasswordForm';
import { IncomeBalanceImportForm } from '@/features/income/IncomeBalanceImportForm';

export default function ProfilePage() {
  return (
    <Stack gap="xl">
      <ChangePasswordForm />
      <IncomeBalanceImportForm />
    </Stack>
  );
}
