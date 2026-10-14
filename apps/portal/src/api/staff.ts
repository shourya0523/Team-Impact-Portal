import type {
  Company,
  IdentitySearchLogEntry,
  ModerationTicket,
  ResolveTicketRequest,
  StaffCommunity,
  Team,
} from '@team-impact/contracts';
import { request, post } from './client';

export const staff = {
  teams: () => request<Team[]>('/staff/teams'),
  companies: () => request<Company[]>('/staff/companies'),
  tickets: () => request<ModerationTicket[]>('/staff/moderation/tickets'),
  resolveTicket: (id: string, body: ResolveTicketRequest) =>
    post<ModerationTicket>(`/staff/moderation/tickets/${id}/resolve`, body),
  communities: () => request<StaffCommunity[]>('/staff/communities'),
  setOfficial: (id: string, official: boolean) =>
    post<StaffCommunity>(`/staff/communities/${id}/official`, { official }, 'PUT'),
  identitySearches: () => request<IdentitySearchLogEntry[]>('/staff/identity-searches'),
};
