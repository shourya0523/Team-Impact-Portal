import type {
  CoachInvite,
  CreateQrCodeRequest,
  JoinRequest,
  QrCodeJoin,
  RemoveMemberResult,
  Team,
  TeamQrCode,
  TeamRoster,
  UpdateTeamRequest,
} from '@team-impact/contracts';
import { post, request } from './client';

/** Coach team management: approvals, roster, QR codes, coach invites, team edits. */
export const team = {
  roster: (teamId: string) => request<TeamRoster>(`/teams/${teamId}/members`),
  removeMember: (teamId: string, userId: string) =>
    request<RemoveMemberResult>(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' }),
  updateTeam: (teamId: string, body: UpdateTeamRequest) =>
    request<Team>(`/teams/${teamId}`, { method: 'PATCH', body: JSON.stringify(body) }),

  teamJoinRequests: (teamId: string) => request<JoinRequest[]>(`/teams/${teamId}/join-requests`),
  decideJoinRequest: (requestId: string, decision: 'approve' | 'decline') =>
    post<JoinRequest>(`/join-requests/${requestId}/decision`, { decision }),

  qrCodes: (teamId: string) => request<TeamQrCode[]>(`/teams/${teamId}/qr-codes`),
  createQrCode: (teamId: string, body: CreateQrCodeRequest) =>
    post<TeamQrCode>(`/teams/${teamId}/qr-codes`, body),
  revokeQrCode: (codeId: string) => post<TeamQrCode>(`/qr-codes/${codeId}/revoke`),
  qrCodeJoins: (codeId: string) => request<QrCodeJoin[]>(`/qr-codes/${codeId}/joins`),

  coachInvites: (teamId: string) => request<CoachInvite[]>(`/teams/${teamId}/coach-invites`),
  inviteCoach: (teamId: string, email: string) =>
    post<CoachInvite>(`/teams/${teamId}/coach-invites`, { email }),
  revokeCoachInvite: (inviteId: string) => post<CoachInvite>(`/coach-invites/${inviteId}/revoke`),
};
