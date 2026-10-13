import type { ApiError, HealthResponse } from '@team-impact/contracts';

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

export const api = {
  health: () => request<HealthResponse>('/health'),
};
