import { buildApp } from './app';
import { createDb } from './db/client';
import { loadEnv } from './env';
import { scheduleEventsLogRetention } from './events-log';
import { createSmtpMailer } from './identity/mailer';

const env = loadEnv();
// env.ts requires DATABASE_URL unless MOCK_API is on. The real API runs on the database with real
// sign-in; the mock API runs on fixtures and keeps its dev sign-in. One pool serves both.
const database = env.MOCK_API || !env.DATABASE_URL ? null : createDb(env.DATABASE_URL);
const db = database?.db;
const app = await buildApp({
  sessionSecret: env.SESSION_SECRET,
  corsOrigins: env.CORS_ORIGINS,
  db,
  logger: true,
  trustProxy: env.TRUST_PROXY,
  mock: env.MOCK_API,
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
  flags: {
    identitySearch: env.FLAG_IDENTITY_SEARCH,
    medicalCommunities: env.FLAG_MEDICAL_COMMUNITIES,
  },
});

if (env.MOCK_API) app.log.warn('MOCK_API is on: serving fixture data, not the database');
if (db) scheduleEventsLogRetention(db, { days: env.EVENTS_LOG_RETENTION_DAYS, log: app.log });

// App Platform sends SIGTERM before replacing an instance: finish requests, then close the pool.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, async () => {
    await app.close();
    await database?.close();
    process.exit(0);
  });
}

await app.listen({ port: env.PORT, host: '0.0.0.0' });
