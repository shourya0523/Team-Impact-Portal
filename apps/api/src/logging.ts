// =============================================================================================
// Request logging without secrets. Fastify logs every request's URL, and some URLs carry a
// one-time secret: an emailed password-reset link is /api/auth/reset-password/<token>, and a
// verification link is /api/auth/verify-email?token=<token>. Anyone who could read the logs could
// use a reset link that was clicked but not yet used. So every URL is redacted before it is
// logged or echoed: the request line, error lines, and the 404 reply (zod.ts).
// =============================================================================================
import type { FastifyRequest } from 'fastify';

/** Where log lines go: pino's destination, e.g. a test's line collector. */
export interface LogStream {
  write(line: string): void;
}

const REDACTED = '[redacted]';
/** Paths whose last segment is a secret (Better Auth's reset link). */
const SECRET_SEGMENT = /(\/reset-password\/)[^/?#]+/;
/** Query parameters that are secrets on any route. */
const SECRET_PARAMS = new Set(['token', 'code', 'password']);

/**
 * `url` with its secrets replaced. Under /api/auth every query value is dropped, since Better Auth
 * puts tokens and redirect targets there; elsewhere only parameters named like a secret are.
 */
export const redactUrl = (url: string): string => {
  const at = url.indexOf('?');
  const path = (at === -1 ? url : url.slice(0, at)).replace(SECRET_SEGMENT, `$1${REDACTED}`);
  if (at === -1) return path;
  const auth = path.startsWith('/api/auth/');
  const kept = [...new URLSearchParams(url.slice(at + 1))].map(([key, value]) =>
    auth || SECRET_PARAMS.has(key.toLowerCase()) ? `${key}=${REDACTED}` : `${key}=${value}`,
  );
  return `${path}?${kept.join('&')}`;
};

/** Fastify's request log fields, with the URL redacted. */
const req = (request: FastifyRequest) => ({
  method: request.method,
  url: redactUrl(request.url),
  host: request.host,
  remoteAddress: request.ip,
  remotePort: request.socket?.remotePort,
});

/**
 * Logger options for Fastify: on or off, or (in tests) writing to `stream` so a test can read
 * what would have been logged.
 */
export const loggerOptions = (logger: boolean | { stream: LogStream }) =>
  logger === false
    ? false
    : { serializers: { req }, ...(logger === true ? {} : { stream: logger.stream }) };
