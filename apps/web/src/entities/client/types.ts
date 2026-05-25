import { StoredFile } from '@/shared/types/file';

export type Client = {
  _id: string;
  name: string;
  inn?: string;
  kpp?: string;
  bankAccount?: string;
  bankName?: string;
  bik?: string;
  correspondentAccount?: string;
  address?: string;
  email?: string;
  phone?: string;
  contract?: string;
  signerName?: string;
  files?: StoredFile[];
};
