import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify from 'fastify';
import { type FeatureFlags as Flags, FeatureFlags, HealthResponse } from '@team-impact/contracts';
import { type AuthConfig, createAuth } from './identity/auth';
import { createLogMailer } from './identity/mailer';
import { registerAuthRoutes } from './identity/routes';
import { type Authenticate, sessionAuth } from './identity/session';
import { registerMockRoutes } from './mock/routes';
import { MockWorld } from './mock/world';
import { useZodContracts } from './zod';

export interface AppOptions {
  sessionSecret: string;
  corsOrigins: string[];
  logger?: boolean;
  flags?: Flags;
  /** Serve fixture data instead of the database (MOCK_API=1). */
  mock?: boolean;
  /**
   * Real sign-in (Better Auth, TI-101), when the API runs on the database. Off on the mock API,
   * which keeps its dev sign-in. Without a mailer, emails go to the log.
   */
  identity?: Omit<AuthConfig, 'mailer' | 'onMailError' | 'trustedOrigins'> &
    Partial<Pick<AuthConfig, 'mailer'>>;
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
  logger = false,
  flags = DEFAULT_FLAGS,
  mock = false,
  identity,
}: AppOptions) => {
  const app = useZodContracts(Fastify({ logger }));

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

  if (mock) registerMockRoutes(app, new MockWorld(flags));

  if (identity) {
    const auth = createAuth({
      ...identity,
      trustedOrigins: corsOrigins,
      mailer: identity.mailer ?? createLogMailer(app.log),
      onMailError: (error, message) =>
        app.log.error({ err: error, subject: message.subject }, 'Auth email failed'),
    });
    app.decorate('authenticate', sessionAuth(auth, identity.db));
    registerAuthRoutes(app, auth);
  }

  return app;
};
