import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify, { type FastifyRequest } from 'fastify';
import {
  type FeatureFlags as Flags,
  FeatureFlags,
  HealthResponse,
  TrackEventRequest,
} from '@team-impact/contracts';
import type { Db } from './db/client';
import { isActiveUser, track } from './events-log';
import { registerMockRoutes } from './mock/routes';
import { MockWorld } from './mock/world';
import { httpError, useZodContracts } from './zod';

export interface AppOptions {
  sessionSecret: string;
  corsOrigins: string[];
  /** Absent when `mock` is on, and in tests that don't need a database. */
  db?: Db;
  /**
   * The signed-in user's id, or null. Real sessions don't exist until auth lands, so by default
   * nobody is signed in and database routes that need a user answer 401.
   */
  currentUserId?: (request: FastifyRequest) => Promise<string | null>;
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
  db,
  currentUserId = async () => null,
  logger = false,
  flags = DEFAULT_FLAGS,
  mock = false,
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

  if (mock) {
    registerMockRoutes(app, new MockWorld(flags));
  } else if (db) {
    /** Client-side events. Everything else is tracked by the route that does the action. */
    app.post('/events', { schema: { body: TrackEventRequest } }, async (request, reply) => {
      const userId = await currentUserId(request);
      if (!userId) throw httpError(401, 'Sign in first.');
      if (!(await isActiveUser(db, request.body.subjectId))) throw httpError(404, 'No such user.');
      await track(db, userId, request.body);
      return reply.status(204).send();
    });
  }

  return app;
};
