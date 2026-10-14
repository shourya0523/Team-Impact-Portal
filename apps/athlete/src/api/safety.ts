import type { Block, CreateReportRequest, MyReport } from '@team-impact/contracts';
import { post, request } from './client';

/** Trust and safety (PRD §9): report, block, delete account. */
export const safety = {
  /** Files a report. The item is hidden for you straight away; staff get a ticket. */
  report: (body: CreateReportRequest) => post<MyReport>('/reports', body),
  myReports: () => request<MyReport[]>('/me/reports'),
  blocks: () => request<Block[]>('/blocks'),
  block: (userId: string) => post<Block>(`/blocks/${userId}`),
  unblock: (userId: string) => request<void>(`/blocks/${userId}`, { method: 'DELETE' }),
  /** Hidden at once, erased after 30 days. A parent's children's profiles go too. */
  deleteAccount: () => request<void>('/me', { method: 'DELETE' }),
};
