import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify, { type FastifyRequest } from 'fastify';
import {
  type FeatureFlags as Flags,
  FeatureFlags,
  HealthResponse,
  TrackEventRequest,
} from '@team-impact/contracts';
import { deleteAccount } from './account-deletion';
import type { Db } from './db/client';
import { isActiveUser, track } from './events-log';
import { type AuthConfig, createAuth } from './identity/auth';
import { createLogMailer } from './identity/mailer';
import { registerAuthRoutes } from './identity/routes';
import { type Authenticate, sessionAuth } from './identity/session';
import { type LogStream, loggerOptions } from './logging';
import { registerMockRoutes } from './mock/routes';
import { MockWorld } from './mock/world';
import { httpError, useZodContracts } from './zod';

export interface AppOptions {
  sessionSecret: string;
  corsOrigins: string[];
  /** Absent when `mock` is on, and in tests that don't need a database. */
  db?: Db;
  /**
   * The signed-in user's id, or null. Defaults to the Better Auth session when `identity` is set,
   * and to nobody otherwise, so database routes that need a user answer 401.
   */
  currentUserId?: (request: FastifyRequest) => Promise<string | null>;
  /** Request logging, with secrets in URLs redacted (logging.ts). A stream lets tests read it. */
  logger?: boolean | { stream: LogStream };
  /** Proxy hops to trust for the caller's IP (TRUST_PROXY). 0 when the API is reached directly. */
  trustProxy?: number;
  flags?: Flags;
  /** Serve fixture data instead of the database (MOCK_API=1). */
  mock?: boolean;
  /**
   * Real sign-in (Better Auth, TI-101), when the API runs on the database. Off on the mock API,
   * which keeps its dev sign-in. Without a mailer, emails go to the log.
   */
  identity?: Omit<AuthConfig, 'mailer' | 'onMailError' | 'trustedOrigins'> &
    Partial<Pick<AuthConfig, 'mailer'>>;
  /**
   * The mock data to serve, for tests that seed it; a fresh fixture world by default. Its own flags
   * win over `flags` in the mock routes, so pass the same ones or `/config/flags` disagrees.
   */
  world?: MockWorld;
  /**
   * With `mock`: serve `/dev/outbox` and print sent email (DEV_OUTBOX=1). Off by default, since
   * the outbox hands out invite links without sign-in.
   */
  devOutbox?: boolean;
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Who a request is from: a signed-in, allowed account, or null (answer 401). */
    authenticate: Authenticate;
  }
}

/** Identity search and medical communities ship on for the pilot (PRD §7, §5). */
const DEFAULT_FLAGS: Flags = { identitySearch: true, medicalCommunities: true };

export const buildApp = async ({
  sessionSecret,
  corsOrigins,
  db,
  currentUserId,
  logger = false,
  trustProxy = 0,
  flags = DEFAULT_FLAGS,
  mock = false,
  devOutbox = false,
  identity,
  world,
}: AppOptions) => {
  const app = useZodContracts(
    Fastify({
      logger: loggerOptions(logger),
      // Trust the nearest `trustProxy` hops' X-Forwarded-For entries, and no further.
      trustProxy: (_address: string, hop: number) => hop < trustProxy,
    }),
  );

  // @fastify/cors only allows GET, HEAD and POST by default; the app also sends PUT, PATCH and DELETE.
  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  await app.register(cookie, { secret: sessionSecret });

  app.get('/health', { schema: { response: { 200: HealthResponse } } }, async () => ({
    status: 'ok' as const,
    version: process.env.APP_VERSION ?? 'dev',
  }));

  app.get('/config/flags', { schema: { response: { 200: FeatureFlags } } }, async () => flags);

  let authenticate: Authenticate | undefined;
  if (identity) {
    const auth = createAuth({
      ...identity,
      trustedOrigins: corsOrigins,
      mailer: identity.mailer ?? createLogMailer(app.log),
      onMailError: (error, message) =>
        app.log.error({ err: error, subject: message.subject }, 'Auth email failed'),
    });
    authenticate = sessionAuth(auth, identity.db);
    app.decorate('authenticate', authenticate);
    registerAuthRoutes(app, auth, {
      authenticate,
      apiUrl: identity.baseURL,
      ownOrigins: [
        identity.baseURL,
        identity.links.portalUrl,
        identity.links.athleteAppUrl,
        ...corsOrigins,
      ],
    });

    if (!mock) {
      /**
       * Deletes the signed-in account (PRD §9): hidden and signed out everywhere at once, erased
       * after 30 days (account-deletion.ts). Same route and answers as the mock API, so the app's
       * Delete account button works unchanged on both.
       */
      app.delete('/me', async (request, reply) => {
        const user = await authenticate!(request);
        if (!user) throw httpError(401, 'Sign in first.');
        const refusal = await deleteAccount(identity.db, user.id);
        if (refusal) throw httpError(...refusal);
        return reply.status(204).send();
      });
    }
  }

  const userIdOf =
    currentUserId ??
    (authenticate
      ? async (request: FastifyRequest) => (await authenticate(request))?.id ?? null
      : async () => null);

  if (mock) {
    registerMockRoutes(app, world ?? new MockWorld(flags, { devOutbox }));
  } else if (db) {
    /** Client-side events. Everything else is tracked by the route that does the action. */
    app.post('/events', { schema: { body: TrackEventRequest } }, async (request, reply) => {
      const userId = await userIdOf(request);
      if (!userId) throw httpError(401, 'Sign in first.');
      if (!(await isActiveUser(db, request.body.subjectId))) throw httpError(404, 'No such user.');
      await track(db, userId, request.body);
      return reply.status(204).send();
    });
  }

  return app;
};
