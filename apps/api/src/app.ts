import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify from 'fastify';
import { HealthResponse } from '@team-impact/contracts';
import { useZodContracts } from './zod';

export interface AppOptions {
  sessionSecret: string;
  corsOrigins: string[];
  logger?: boolean;
}

export const buildApp = async ({ sessionSecret, corsOrigins, logger = false }: AppOptions) => {
  const app = useZodContracts(Fastify({ logger }));

  await app.register(cors, { origin: corsOrigins, credentials: true });
  await app.register(cookie, { secret: sessionSecret });

  app.get('/health', { schema: { response: { 200: HealthResponse } } }, async () => ({
    status: 'ok' as const,
    version: process.env.APP_VERSION ?? 'dev',
  }));

  return app;
};
