import { StoredFile } from '@/shared/types/file';

export type Organization = {
  _id: string;
  name: string;
  shortName?: string;
  inn?: string;
  kpp?: string;
  bankAccount?: string;
  bankName?: string;
  bik?: string;
  correspondentAccount?: string;
  address?: string;
  email?: string;
  phone?: string;
  signerName?: string;
  chiefAccountant?: string;
  files?: StoredFile[];
};
