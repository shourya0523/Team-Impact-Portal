import { buildApp } from './app';
import { devHeaderAuth } from './auth';
import { createDb } from './db/client';
import { loadEnv } from './env';
import { scheduleEventsLogRetention } from './events-log';
import { createS3Storage } from './storage';

const env = loadEnv();
// env.ts requires DATABASE_URL unless MOCK_API is on.
const db = env.MOCK_API || !env.DATABASE_URL ? undefined : createDb(env.DATABASE_URL).db;

const media = () =>
  db && {
    db,
    // loadEnv requires these unless MOCK_API.
    storage: createS3Storage({
      endpoint: env.S3_ENDPOINT!,
      region: env.S3_REGION,
      bucket: env.S3_BUCKET!,
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    }),
    // TODO(auth): swap for the real session check once auth lands.
    authenticate: devHeaderAuth(db, env.NODE_ENV),
  };

const app = await buildApp({
  sessionSecret: env.SESSION_SECRET,
  corsOrigins: env.CORS_ORIGINS,
  db,
  logger: true,
  mock: env.MOCK_API,
  flags: {
    identitySearch: env.FLAG_IDENTITY_SEARCH,
    medicalCommunities: env.FLAG_MEDICAL_COMMUNITIES,
  },
  media: media(),
});

if (env.MOCK_API) app.log.warn('MOCK_API is on: serving fixture data, not the database');
if (db) scheduleEventsLogRetention(db, { days: env.EVENTS_LOG_RETENTION_DAYS, log: app.log });

await app.listen({ port: env.PORT, host: '0.0.0.0' });
