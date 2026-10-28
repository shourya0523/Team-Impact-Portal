import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify from 'fastify';
import { type FeatureFlags as Flags, FeatureFlags, HealthResponse } from '@team-impact/contracts';
import { registerMockRoutes } from './mock/routes';
import { mediaRoutes, type MediaRoutesOptions } from './routes/media';
import { MockWorld } from './mock/world';
import { useZodContracts } from './zod';

export interface AppOptions {
  sessionSecret: string;
  corsOrigins: string[];
  logger?: boolean;
  flags?: Flags;
  /** Serve fixture data instead of the database (MOCK_API=1). */
  mock?: boolean;
  /** Database, bucket and auth for the upload routes; absent on mocks. */
  media?: MediaRoutesOptions;
}

/** Identity search and medical communities ship on for the pilot (PRD §7, §5). */
const DEFAULT_FLAGS: Flags = { identitySearch: true, medicalCommunities: true };

export const buildApp = async ({
  sessionSecret,
  corsOrigins,
  logger = false,
  flags = DEFAULT_FLAGS,
  mock = false,
  media,
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
  if (media) await app.register(mediaRoutes, media);

  return app;
};
