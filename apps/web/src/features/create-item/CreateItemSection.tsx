'use client';

import React from 'react';
import { Button, Collapse, Stack } from '@mantine/core';

type CreateItemSectionProps = {
  createLabel: string;
  isEditing: boolean;
  children: React.ReactNode;
};

export const CreateItemSection: React.FC<CreateItemSectionProps> = ({ createLabel, isEditing, children }) => {
  const [isCreateOpened, setIsCreateOpened] = React.useState(false);

  const isFormVisible = isEditing || isCreateOpened;

  return (
    <Stack gap="md">
      <Button
        type="button"
        variant={isCreateOpened || isEditing ? 'light' : 'filled'}
        color={isEditing ? 'gray' : undefined}
        disabled={isEditing}
        onClick={() => setIsCreateOpened((prev) => !prev)}
      >
        {isEditing ? 'Режим редактирования' : isCreateOpened ? 'Скрыть форму' : createLabel}
      </Button>
      <Collapse in={isFormVisible}>{children}</Collapse>
    </Stack>
  );
};
