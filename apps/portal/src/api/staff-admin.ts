import type {
  CoachInvite,
  College,
  Company,
  CreateAnnouncementRequest,
  CreateCompanyRequest,
  CreateTeamRequest,
  Post,
  RemoveMemberResult,
  StaffCommunity,
  StaffUpdateTeamRequest,
  Team,
  TeamCoaches,
} from '@team-impact/contracts';
import { post, request } from './client';

/** Staff writes: colleges, teams and coaches, companies, communities, announcements (PRD §9). */
export const staffAdmin = {
  colleges: () => request<College[]>('/staff/colleges'),
  createCollege: (name: string) => post<College>('/staff/colleges', { name }),
  renameCollege: (id: string, name: string) =>
    post<College>(`/staff/colleges/${id}`, { name }, 'PUT'),
  mergeCollege: (id: string, intoCollegeId: string) =>
    post<College>(`/staff/colleges/${id}/merge`, { intoCollegeId }),

  createTeam: (body: CreateTeamRequest) => post<Team>('/staff/teams', body),
  updateTeam: (id: string, body: StaffUpdateTeamRequest) =>
    post<Team>(`/staff/teams/${id}`, body, 'PATCH'),
  archiveTeam: (id: string) => post<Team>(`/staff/teams/${id}/archive`),
  coaches: (teamId: string) => request<TeamCoaches>(`/staff/teams/${teamId}/coaches`),
  inviteCoach: (teamId: string, email: string) =>
    post<CoachInvite>(`/staff/teams/${teamId}/coach-invites`, { email }),
  revokeInvite: (id: string) => post<CoachInvite>(`/staff/coach-invites/${id}/revoke`),
  /** A fresh link and 7 more days for the same email; the old link stops working. */
  resendInvite: (id: string) => post<CoachInvite>(`/staff/coach-invites/${id}/resend`),
  /** The shared roster route; a live team's last coach can't be removed. */
  removeCoach: (teamId: string, userId: string) =>
    request<RemoveMemberResult>(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' }),

  createCompany: (body: CreateCompanyRequest) => post<Company>('/staff/companies', body),
  suspendCompany: (id: string) => post<Company>(`/staff/companies/${id}/suspend`),
  restoreCompany: (id: string) => post<Company>(`/staff/companies/${id}/restore`),

  mergeCommunity: (id: string, intoId: string) =>
    post<StaffCommunity>(`/staff/communities/${id}/merge`, { intoId }),
  removeCommunity: (id: string) => request<void>(`/staff/communities/${id}`, { method: 'DELETE' }),

  announcements: () => request<Post[]>('/staff/announcements'),
  announce: (body: CreateAnnouncementRequest) => post<Post>('/staff/announcements', body),
};
