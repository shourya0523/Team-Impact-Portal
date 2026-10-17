import type { ApiError, TrackEventRequest } from '@team-impact/contracts';

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

export const post = <T>(path: string, body?: unknown, method = 'POST') =>
  request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

/** Drops empty filters so the URL only carries what the recruiter set. */
export const query = (params: Record<string, string | number | undefined>) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : '';
};

export type Page<T> = { items: T[]; nextCursor: string | null };

/**
 * Logs a client-side event from `TRACKED_EVENTS` in contracts; the API logs the rest itself.
 * Fire and forget: a failed log never gets in the way of the screen.
 */
export const track = (event: TrackEventRequest): void => {
  post<void>('/events', event).catch(() => undefined);
};
