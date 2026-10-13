import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify from 'fastify';
import { type FeatureFlags as Flags, FeatureFlags, HealthResponse } from '@team-impact/contracts';
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
}

/** Identity search and medical communities ship on for the pilot (PRD §7, §5). */
const DEFAULT_FLAGS: Flags = { identitySearch: true, medicalCommunities: true };

export const buildApp = async ({
  sessionSecret,
  corsOrigins,
  logger = false,
  flags = DEFAULT_FLAGS,
  mock = false,
}: AppOptions) => {
  const app = useZodContracts(Fastify({ logger }));

  await app.register(cors, { origin: corsOrigins, credentials: true });
  await app.register(cookie, { secret: sessionSecret });

  app.get('/health', { schema: { response: { 200: HealthResponse } } }, async () => ({
    status: 'ok' as const,
    version: process.env.APP_VERSION ?? 'dev',
  }));

  app.get('/config/flags', { schema: { response: { 200: FeatureFlags } } }, async () => flags);

  if (mock) registerMockRoutes(app, new MockWorld(flags));

  return app;
};
