import type { CalendarEvent, Community, CommunityJoinRequest, Post } from '@team-impact/contracts';
import { request, post } from './client';

export const communities = {
  feed: () => request<{ items: Post[]; nextCursor: string | null }>('/feed'),
  events: () => request<CalendarEvent[]>('/events'),
  communities: () => request<Community[]>('/communities'),
  community: (id: string) => request<Community>(`/communities/${id}`),
  communityPosts: (id: string) =>
    request<{ items: Post[]; nextCursor: string | null }>(`/communities/${id}/posts`),
  /** Joins an open community, or asks to join a private one (the creator approves). */
  joinCommunity: (id: string) => post<Community>(`/communities/${id}/join`),
  /** The creator's queue for a private community. */
  communityJoinRequests: (id: string) =>
    request<CommunityJoinRequest[]>(`/communities/${id}/requests`),
  decideCommunityJoin: (id: string, userId: string, decision: 'approve' | 'decline') =>
    post<CommunityJoinRequest[]>(`/communities/${id}/requests/${userId}`, { decision }),
  /** "Recruiters can find me through this community" (official communities, published cards). */
  setFindable: (id: string, recruiterSearchOptIn: boolean) =>
    request<Community>(`/communities/${id}/membership`, {
      method: 'PUT',
      body: JSON.stringify({ recruiterSearchOptIn }),
    }),
};
