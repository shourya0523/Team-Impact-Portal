import { buildApp } from './app';
import { devHeaderAuth } from './auth';
import { createDb } from './db/client';
import { loadEnv } from './env';
import { createS3Storage } from './storage';

const env = loadEnv();

const media = () => {
  // loadEnv requires these unless MOCK_API.
  const { db } = createDb(env.DATABASE_URL!);
  return {
    db,
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
};

const app = await buildApp({
  sessionSecret: env.SESSION_SECRET,
  corsOrigins: env.CORS_ORIGINS,
  logger: true,
  mock: env.MOCK_API,
  flags: {
    identitySearch: env.FLAG_IDENTITY_SEARCH,
    medicalCommunities: env.FLAG_MEDICAL_COMMUNITIES,
  },
  media: env.MOCK_API ? undefined : media(),
});

if (env.MOCK_API) app.log.warn('MOCK_API is on: serving fixture data, not the database');

await app.listen({ port: env.PORT, host: '0.0.0.0' });
