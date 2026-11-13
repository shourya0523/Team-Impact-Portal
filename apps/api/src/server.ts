import { buildApp } from './app';
import { createDb } from './db/client';
import { loadEnv } from './env';
import { scheduleAccountErasure } from './account-deletion';
import { scheduleEventsLogRetention } from './events-log';
import { createSmtpMailer } from './identity/mailer';
import { openAiScreen } from './moderation';
import { resumeConfigFromEnv } from './resume';

const env = loadEnv();
// env.ts requires DATABASE_URL unless MOCK_API is on. The real API runs on the database with real
// sign-in; the mock API runs on fixtures and keeps its dev sign-in. One pool serves both.
const database = env.MOCK_API || !env.DATABASE_URL ? null : createDb(env.DATABASE_URL);
const db = database?.db;
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
  trustProxy: env.TRUST_PROXY,
  mock: env.MOCK_API,
  devOutbox: env.DEV_OUTBOX,
  identity: database
    ? {
        db: database.db,
        secret: env.SESSION_SECRET,
        baseURL: env.API_URL,
        links: { portalUrl: env.PORTAL_URL, athleteAppUrl: env.ATHLETE_APP_URL },
        // Without SMTP_URL (development only; env.ts requires it in production) emails are logged.
        mailer: env.SMTP_URL ? createSmtpMailer(env.SMTP_URL, env.MAIL_FROM) : undefined,
        production: env.NODE_ENV === 'production',
      }
    : undefined,
  screen,
  flags: {
    identitySearch: env.FLAG_IDENTITY_SEARCH,
    medicalCommunities: env.FLAG_MEDICAL_COMMUNITIES,
  },
  resume: resumeConfigFromEnv(env),
});

if (env.MOCK_API) app.log.warn('MOCK_API is on: serving fixture data, not the database');
if (env.MOCK_API && env.DEV_OUTBOX)
  app.log.warn('DEV_OUTBOX is on: /dev/outbox serves invite links');
if (!screen) app.log.warn('OPENAI_API_KEY is not set: all new content waits for staff review');
if (db) scheduleEventsLogRetention(db, { days: env.EVENTS_LOG_RETENTION_DAYS, log: app.log });
// Accounts deleted 30 days ago are erased daily. Uploaded files join in once storage exists (#8).
if (db) scheduleAccountErasure(db, { log: app.log });

// App Platform sends SIGTERM before replacing an instance: finish requests, then close the pool.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, async () => {
    await app.close();
    await database?.close();
    process.exit(0);
  });
}

await app.listen({ port: env.PORT, host: '0.0.0.0' });
