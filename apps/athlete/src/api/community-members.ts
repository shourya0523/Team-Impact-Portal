import type { CalendarEvent, CommunityMember } from '@team-impact/contracts';
import { request } from './client';

/** A community page's Events and Members tabs. */
export const communityMembers = {
  communityEvents: (id: string) => request<CalendarEvent[]>(`/communities/${id}/events`),
  /** Members only; never for medical or Team Impact communities, never for recruiters. */
  communityMembers: (id: string) => request<CommunityMember[]>(`/communities/${id}/members`),
};
