import { buildApp } from './app';
import { loadEnv } from './env';

const env = loadEnv();
const app = await buildApp({
  sessionSecret: env.SESSION_SECRET,
  corsOrigins: env.CORS_ORIGINS,
  logger: true,
  mock: env.MOCK_API,
  flags: {
    identitySearch: env.FLAG_IDENTITY_SEARCH,
    medicalCommunities: env.FLAG_MEDICAL_COMMUNITIES,
  },
});

if (env.MOCK_API) app.log.warn('MOCK_API is on: serving fixture data, not the database');

await app.listen({ port: env.PORT, host: '0.0.0.0' });
