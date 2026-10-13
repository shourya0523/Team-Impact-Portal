import type {
  ApiError,
  AthleteSearchQuery,
  CardFace,
  CardWithContact,
  Community,
  Company,
  FeatureFlags,
  HealthResponse,
  IdentitySearchLogEntry,
  Me,
  ModerationTicket,
  RecruiterList,
  RecruiterListDetail,
  ResolveTicketRequest,
  Role,
  StaffCommunity,
  Team,
} from '@team-impact/contracts';

/** Any non-2xx response. `body` is the API's shared error shape, so forms can show `issues` inline. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError,
  ) {
    super(body.error.message);
  }
}

/**
 * Responses are typed by the shared contracts, not re-validated: the API already parses every
 * response against them. Paths are proxied to the API by Vite in development (vite.config.ts).
 */
export const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    // Fastify rejects an empty body sent as JSON, so only label requests that have one.
    headers: init.body ? { 'content-type': 'application/json', ...init.headers } : init.headers,
  });
  const body: unknown = res.status === 204 ? undefined : await res.json();
  if (!res.ok) throw new ApiRequestError(res.status, body as ApiError);
  return body as T;
};

const post = <T>(path: string, body?: unknown, method = 'POST') =>
  request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

/** Drops empty filters so the URL only carries what the recruiter set. */
const query = (params: Record<string, string | number | undefined>) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : '';
};

type Page<T> = { items: T[]; nextCursor: string | null };

export const api = {
  health: () => request<HealthResponse>('/health'),
  flags: () => request<FeatureFlags>('/config/flags'),

  me: () => request<Me>('/me'),
  /** Mock API only: sign in as a role's fixture user. */
  devSignIn: (role: Role) => post<Me>('/auth/dev-sign-in', { role }),
  signOut: () => post<void>('/auth/sign-out'),

  communities: () => request<Community[]>('/communities'),

  searchAthletes: (q: Omit<AthleteSearchQuery, 'cursor' | 'limit'>) =>
    request<Page<CardFace>>(`/search/athletes${query({ ...q, limit: 100 })}`),
  card: (athleteId: string) => request<CardWithContact>(`/cards/${athleteId}`),
  lists: () => request<RecruiterList[]>('/lists'),
  list: (id: string) => request<RecruiterListDetail>(`/lists/${id}`),

  staff: {
    teams: () => request<Team[]>('/staff/teams'),
    companies: () => request<Company[]>('/staff/companies'),
    tickets: () => request<ModerationTicket[]>('/staff/moderation/tickets'),
    resolveTicket: (id: string, body: ResolveTicketRequest) =>
      post<ModerationTicket>(`/staff/moderation/tickets/${id}/resolve`, body),
    communities: () => request<StaffCommunity[]>('/staff/communities'),
    setOfficial: (id: string, official: boolean) =>
      post<StaffCommunity>(`/staff/communities/${id}/official`, { official }, 'PUT'),
    identitySearches: () => request<IdentitySearchLogEntry[]>('/staff/identity-searches'),
  },
};
