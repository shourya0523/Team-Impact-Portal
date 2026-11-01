import type {
  CalendarEvent,
  Community,
  CommunityJoinRequest,
  FeedScope,
  Post,
} from '@team-impact/contracts';
import { type Page, request, post } from './client';

/**
 * Posts per feed page. Unset, the API's default (20) applies; set `EXPO_PUBLIC_FEED_PAGE_SIZE=3`
 * when starting Expo to page through the mock's few posts while working on the feeds.
 */
const PAGE_SIZE = Number(process.env.EXPO_PUBLIC_FEED_PAGE_SIZE) || undefined;

/** `path`, plus `?cursor=` for a page after the first, the page size, and any other query set. */
const paged = (path: string, cursor?: string, query: Record<string, string> = {}) => {
  const q = new URLSearchParams({
    ...query,
    ...(PAGE_SIZE ? { limit: String(PAGE_SIZE) } : {}),
    ...(cursor ? { cursor } : {}),
  }).toString();
  return q ? `${path}?${q}` : path;
};

export const communities = {
  /**
   * Pass the previous page's `nextCursor` for the next page, with the same `scope`: a cursor only
   * works on the chip that issued it.
   */
  feed: (cursor?: string, scope: FeedScope = 'all') =>
    request<Page<Post>>(paged('/feed', cursor, scope === 'all' ? {} : { scope })),
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
