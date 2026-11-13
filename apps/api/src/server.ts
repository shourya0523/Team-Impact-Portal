import { buildApp } from './app';
import { createDb } from './db/client';
import { loadEnv } from './env';
import { scheduleEventsLogRetention } from './events-log';

const env = loadEnv();
// env.ts requires DATABASE_URL unless MOCK_API is on.
const db = env.MOCK_API || !env.DATABASE_URL ? undefined : createDb(env.DATABASE_URL).db;
const app = await buildApp({
  sessionSecret: env.SESSION_SECRET,
  corsOrigins: env.CORS_ORIGINS,
  db,
  logger: true,
  mock: env.MOCK_API,
  devOutbox: env.DEV_OUTBOX,
  flags: {
    identitySearch: env.FLAG_IDENTITY_SEARCH,
    medicalCommunities: env.FLAG_MEDICAL_COMMUNITIES,
  },
});

if (env.MOCK_API) app.log.warn('MOCK_API is on: serving fixture data, not the database');
if (env.MOCK_API && env.DEV_OUTBOX)
  app.log.warn('DEV_OUTBOX is on: /dev/outbox serves invite links');
if (db) scheduleEventsLogRetention(db, { days: env.EVENTS_LOG_RETENTION_DAYS, log: app.log });

await app.listen({ port: env.PORT, host: '0.0.0.0' });
