import { buildApp } from './app';
import { createDb } from './db/client';
import { loadEnv } from './env';
import { createSmtpMailer } from './identity/mailer';

const env = loadEnv();
// The real API runs on the database; the mock API on fixtures (and keeps its dev sign-in).
const database = env.MOCK_API ? null : createDb(env.DATABASE_URL!);
const app = await buildApp({
  sessionSecret: env.SESSION_SECRET,
  corsOrigins: env.CORS_ORIGINS,
  logger: true,
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

// App Platform sends SIGTERM before replacing an instance: finish requests, then close the pool.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, async () => {
    await app.close();
    await database?.close();
    process.exit(0);
  });
}

await app.listen({ port: env.PORT, host: '0.0.0.0' });
