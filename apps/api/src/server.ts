import { buildApp } from './app';
import { loadEnv } from './env';

const env = loadEnv();
const app = await buildApp({
  sessionSecret: env.SESSION_SECRET,
  corsOrigins: env.CORS_ORIGINS,
  logger: true,
});

await app.listen({ port: env.PORT, host: '0.0.0.0' });
