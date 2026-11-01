import { ApiRequestError } from './client';

const OFFLINE = 'You seem to be offline. Check your connection and try again.';
const SERVER = 'Something went wrong on our side. Try again in a moment.';

/**
 * A failed request in words for people. The API's own 4xx messages already are ("No such
 * community"), so they pass through; `fetch` failing to connect throws a bare `TypeError`
 * ("Failed to fetch", "Network request failed"); anything else (a 5xx, a response that isn't
 * JSON) gets a generic line rather than a stack-trace word.
 */
export const describeError = (error: unknown): string => {
  if (error instanceof ApiRequestError) return error.status >= 500 ? SERVER : error.message;
  if (error instanceof TypeError) return OFFLINE;
  return SERVER;
};

/** The API says it doesn't exist, or that you may not know it does (removed, hidden from you). */
export const isNotFound = (error: unknown) =>
  error instanceof ApiRequestError && error.status === 404;
