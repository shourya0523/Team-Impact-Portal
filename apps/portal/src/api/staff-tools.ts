import type { ModerationLogEntry, Recruiter, SuspendedUser } from '@team-impact/contracts';
import { post, request } from './client';

/** Staff tools on accounts: recruiter decline and suspension, suspended users, the moderation log. */
export const staffTools = {
  declineRecruiter: (id: string) => post<void>(`/staff/recruiter-sign-ups/${id}/decline`),
  recruiters: () => request<Recruiter[]>('/staff/recruiters'),
  suspendRecruiter: (id: string) => post<Recruiter>(`/staff/recruiters/${id}/suspend`),
  restoreRecruiter: (id: string) => post<Recruiter>(`/staff/recruiters/${id}/restore`),
  suspendedUsers: () => request<SuspendedUser[]>('/staff/suspended-users'),
  unsuspendUser: (id: string) => post<SuspendedUser[]>(`/staff/users/${id}/unsuspend`),
  moderationLog: () => request<ModerationLogEntry[]>('/staff/moderation/log'),
};
