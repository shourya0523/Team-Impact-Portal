import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify, { type FastifyRequest } from 'fastify';
import { HealthResponse, TrackEventRequest } from '@team-impact/contracts';
import type { Db } from './db/client';
import { isActiveUser, track } from './events-log';
import { httpError, useZodContracts } from './zod';

export interface AppOptions {
  sessionSecret: string;
  corsOrigins: string[];
  db: Db;
  /**
   * The signed-in user's id, or null. There are no sessions until auth lands, so by default
   * nobody is signed in and routes that need a user answer 401.
   */
  currentUserId?: (request: FastifyRequest) => Promise<string | null>;
  logger?: boolean;
}

export const buildApp = async ({
  sessionSecret,
  corsOrigins,
  db,
  currentUserId = async () => null,
  logger = false,
}: AppOptions) => {
  const app = useZodContracts(Fastify({ logger }));

  await app.register(cors, { origin: corsOrigins, credentials: true });
  await app.register(cookie, { secret: sessionSecret });

  app.get('/health', { schema: { response: { 200: HealthResponse } } }, async () => ({
    status: 'ok' as const,
    version: process.env.APP_VERSION ?? 'dev',
  }));

  /** Client-side events. Everything else is tracked by the route that does the action. */
  app.post('/events', { schema: { body: TrackEventRequest } }, async (request, reply) => {
    const userId = await currentUserId(request);
    if (!userId) throw httpError(401, 'Sign in first.');
    if (!(await isActiveUser(db, request.body.subjectId))) throw httpError(404, 'No such user.');
    await track(db, userId, request.body);
    return reply.status(204).send();
  });

  return app;
};
