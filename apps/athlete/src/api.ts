import type {
  ApiError,
  CalendarEvent,
  College,
  Community,
  CommunityJoinRequest,
  CreateJoinRequest,
  HealthResponse,
  JoinRequest,
  Me,
  Post,
  Role,
  TeamSummary,
} from '@team-impact/contracts';

/** Set per build; the default reaches a local API from web and the iOS simulator. */
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

/** Any non-2xx response. `body` is the API's shared error shape, so forms can show `issues` inline. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError,
  ) {
    super(body.error.message);
  }
}

/** Responses are typed by the shared contracts, not re-validated: the API already parses them. */
export const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    // Fastify rejects an empty body sent as JSON, so only label requests that have one.
    headers: init.body ? { 'content-type': 'application/json', ...init.headers } : init.headers,
  });
  const body: unknown = res.status === 204 ? undefined : await res.json();
  if (!res.ok) throw new ApiRequestError(res.status, body as ApiError);
  return body as T;
};

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  health: () => request<HealthResponse>('/health'),
  me: () => request<Me>('/me'),
  /** Mock API only: sign in as a role's fixture user, or a newcomer on no team yet. */
  devSignIn: (role: Role, newcomer = false) => post<Me>('/auth/dev-sign-in', { role, newcomer }),
  signOut: () => post<void>('/auth/sign-out'),

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

  colleges: () => request<College[]>('/colleges'),
  teams: (collegeId: string) => request<TeamSummary[]>(`/teams?collegeId=${collegeId}`),
  requestToJoin: (body: CreateJoinRequest) => post<JoinRequest>('/join-requests', body),
};
