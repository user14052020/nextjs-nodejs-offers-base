import { apiFetch } from '@/shared/api/http';

import { MonthlyClientReportMonth } from './types';

export const fetchMonthlyClientReport = () =>
  apiFetch<MonthlyClientReportMonth[]>('/works/reports/monthly-clients');
