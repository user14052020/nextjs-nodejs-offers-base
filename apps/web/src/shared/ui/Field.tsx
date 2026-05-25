import React from 'react';
import { Stack, Text } from '@mantine/core';

type FieldProps = {
  label: string;
  children: React.ReactNode;
};

export const Field: React.FC<FieldProps> = ({ label, children }) => {
  return (
    <Stack gap={6}>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      {children}
    </Stack>
  );
};
