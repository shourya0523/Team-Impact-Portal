import type { CalendarEvent, Community, CommunityJoinRequest, Post } from '@team-impact/contracts';
import { type Page, request, post } from './client';

/** `path`, plus `?cursor=` for a page after the first. */
const paged = (path: string, cursor?: string) =>
  cursor ? `${path}?${new URLSearchParams({ cursor })}` : path;

export const communities = {
  /** Pass the previous page's `nextCursor` for the next page. */
  feed: (cursor?: string) => request<Page<Post>>(paged('/feed', cursor)),
  events: () => request<CalendarEvent[]>('/events'),
  communities: () => request<Community[]>('/communities'),
  community: (id: string) => request<Community>(`/communities/${id}`),
  communityPosts: (id: string, cursor?: string) =>
    request<Page<Post>>(paged(`/communities/${id}/posts`, cursor)),
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
