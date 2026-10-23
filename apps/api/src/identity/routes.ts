// =============================================================================================
// Mounts Better Auth's endpoints on Fastify at /api/auth/* (sign-up, sign-in, sign-out, verify
// email, reset password, get session, …), following Better Auth's Fastify guide: each request is
// turned into a standard Fetch `Request`, handed to Better Auth, and its `Response` copied back.
//
// Three safeguards are added on the way:
//   - Redirect targets (callbackURL, redirectTo, …) must be our own API, portal or app. Better
//     Auth would otherwise follow a link someone edited to end on their own site, turning a real
//     Team Impact email into a phishing link.
//   - The caller's IP comes from Fastify (which trusts only our own proxy, see TRUST_PROXY), and
//     replaces any X-Forwarded-For the caller sent. Better Auth rate-limits by that header, so a
//     caller could otherwise dodge the limits by sending a fake IP with every request.
//   - Session tokens are removed from every JSON response. Browsers hold the session in an
//     HttpOnly cookie and the Expo client stores it from the Set-Cookie header, so no client
//     needs the token in a body, where an injected script could read it.
//
// Our own routes don't go through here: they call `app.authenticate(request)` (session.ts).
// =============================================================================================
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Auth } from './auth';
import type { Authenticate } from './session';

/** Request fields Better Auth redirects to once it's done (verify email, password reset, …). */
const REDIRECT_PARAMS = ['callbackURL', 'errorCallbackURL', 'newUserCallbackURL', 'redirectTo'];
/** The Expo app's deep-link scheme (apps/athlete/app.json). */
const APP_SCHEME = 'teamimpact:';

/**
 * Whether `target` lands somewhere of ours. Relative targets resolve against the API, so
 * protocol-relative tricks like `//evil.example` resolve to evil.example and are refused.
 */
const isOwnTarget = (target: string, apiUrl: string, origins: ReadonlySet<string>) => {
  try {
    const url = new URL(target, apiUrl);
    return url.protocol === APP_SCHEME || origins.has(url.origin);
  } catch {
    return false;
  }
};

/** The first redirect target in the query or body that isn't ours, if any. */
const foreignTarget = (request: FastifyRequest, apiUrl: string, origins: ReadonlySet<string>) => {
  const query = request.query as Record<string, unknown>;
  const body = (request.body ?? {}) as Record<string, unknown>;
  for (const source of [query, body]) {
    for (const key of REDIRECT_PARAMS) {
      const value = source?.[key];
      if (typeof value === 'string' && !isOwnTarget(value, apiUrl, origins)) return value;
      if (value !== undefined && typeof value !== 'string') return String(value);
    }
  }
  return null;
};

/** Headers a caller could use to claim a different IP. Fastify's `request.ip` replaces them. */
const CLIENT_IP_HEADERS = ['x-forwarded-for', 'x-real-ip', 'x-client-ip', 'forwarded'];

const toFetchRequest = (request: FastifyRequest) => {
  const url = new URL(request.url, `${request.protocol}://${request.host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined || CLIENT_IP_HEADERS.includes(key)) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  headers.set('x-forwarded-for', request.ip);
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD' && request.body != null;
  return new Request(url, {
    method: request.method,
    headers,
    body: hasBody ? JSON.stringify(request.body) : undefined,
  });
};

/** Deletes every `token` property, at any depth (sign-in, get-session, list-sessions, …). */
const withoutTokens = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(withoutTokens);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'token')
        .map(([key, inner]) => [key, withoutTokens(inner)]),
    );
  }
  return value;
};

const sendFetchResponse = async (response: Response, reply: FastifyReply) => {
  reply.status(response.status);
  response.headers.forEach((value, key) => {
    // Set-Cookie can repeat; Headers#forEach would merge them into one invalid header. The body
    // is re-encoded below, so its old length no longer applies.
    if (key !== 'set-cookie' && key !== 'content-length') reply.header(key, value);
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) reply.header('set-cookie', cookies);

  if (!response.body) return reply.send(null);
  if (response.headers.get('content-type')?.includes('application/json')) {
    const text = await response.text();
    return reply.send(text ? JSON.stringify(withoutTokens(JSON.parse(text))) : text);
  }
  return reply.send(Buffer.from(await response.arrayBuffer()));
};

export interface AuthRouteOptions {
  /** The API's own URL; relative redirect targets resolve against it. */
  apiUrl: string;
  /** Origins a redirect may land on: the API, the portal, the athlete app (web). */
  ownOrigins: string[];
  /** Ends a suspended or deleted account's sessions before Better Auth reads them. */
  authenticate: Authenticate;
}

export const registerAuthRoutes = (
  app: FastifyInstance,
  auth: Auth,
  { apiUrl, ownOrigins, authenticate }: AuthRouteOptions,
) => {
  const origins = new Set(ownOrigins.map((o) => new URL(o).origin));
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    handler: async (request, reply) => {
      if (foreignTarget(request, apiUrl, origins) !== null) {
        return reply.status(400).send({
          code: 'INVALID_REDIRECT',
          message: 'That link points somewhere outside Team Impact.',
        });
      }
      // A session cookie from an account that has since been suspended or deleted is ended here,
      // so get-session and the rest answer "signed out" too, not only our own routes.
      if (request.headers.cookie) await authenticate(request);
      return sendFetchResponse(await auth.handler(toFetchRequest(request)), reply);
    },
  });
};
