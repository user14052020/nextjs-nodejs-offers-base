import { apiFetch } from '@/shared/api/http';

import { MonthlyClientReport } from './types';

export const fetchMonthlyClientReport = (paidOnly: boolean) =>
  apiFetch<MonthlyClientReport>(`/works/reports/monthly-clients?paidOnly=${paidOnly ? 'true' : 'false'}`);
