import { buildApp } from './app';
import { createDb } from './db/client';
import { loadEnv } from './env';
import { scheduleEventsLogRetention } from './events-log';
import { openAiScreen } from './moderation';

const env = loadEnv();
// env.ts requires DATABASE_URL unless MOCK_API is on.
const db = env.MOCK_API || !env.DATABASE_URL ? undefined : createDb(env.DATABASE_URL).db;
const screen = env.OPENAI_API_KEY
  ? openAiScreen({
      apiKey: env.OPENAI_API_KEY,
      thresholds: { holdAt: env.MODERATION_HOLD_AT, blockAt: env.MODERATION_BLOCK_AT },
      onError: (err) => app.log.warn({ err }, 'Moderation screen failed; holding for staff'),
    })
  : undefined;
const app = await buildApp({
  sessionSecret: env.SESSION_SECRET,
  corsOrigins: env.CORS_ORIGINS,
  db,
  logger: true,
  mock: env.MOCK_API,
  screen,
  flags: {
    identitySearch: env.FLAG_IDENTITY_SEARCH,
    medicalCommunities: env.FLAG_MEDICAL_COMMUNITIES,
  },
});

if (env.MOCK_API) app.log.warn('MOCK_API is on: serving fixture data, not the database');
if (!screen) app.log.warn('OPENAI_API_KEY is not set: all new content waits for staff review');
if (db) scheduleEventsLogRetention(db, { days: env.EVENTS_LOG_RETENTION_DAYS, log: app.log });

await app.listen({ port: env.PORT, host: '0.0.0.0' });
