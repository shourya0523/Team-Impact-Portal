import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify from 'fastify';
import type { HealthResponse } from '@team-impact/contracts';

export interface AppOptions {
  sessionSecret: string;
  corsOrigins: string[];
  logger?: boolean;
}

export const buildApp = async ({ sessionSecret, corsOrigins, logger = false }: AppOptions) => {
  const app = Fastify({ logger });

  await app.register(cors, { origin: corsOrigins, credentials: true });
  await app.register(cookie, { secret: sessionSecret });

  app.get('/health', async (): Promise<HealthResponse> => ({
    status: 'ok',
    version: process.env.APP_VERSION ?? 'dev',
  }));

  return app;
};
