import { z } from 'zod';

/** Only for local mock runs, where nothing real is signed. */
const DEV_SESSION_SECRET = 'mock-api-session-secret-not-for-real-use';

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    /** Serves fixture data from `src/mock` instead of the database, so clients can run without one. */
    MOCK_API: z.stringbool().default(false),
    DATABASE_URL: z.url().optional(),
    SESSION_SECRET: z.string().min(32).optional(),
    CORS_ORIGINS: z
      .string()
      // The portal (Vite) and the athlete app on web (Expo).
      .default('http://localhost:5173,http://localhost:8081')
      .transform((value) => value.split(',').map((origin) => origin.trim())),
    FLAG_IDENTITY_SEARCH: z.stringbool().default(true),
    FLAG_MEDICAL_COMMUNITIES: z.stringbool().default(true),
    // Private bucket for uploads (TI-111): DigitalOcean Spaces in staging and production.
    S3_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().default('us-east-1'),
    S3_BUCKET: z.string().min(1).optional(),
    S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (!env.MOCK_API && !env.DATABASE_URL) {
      ctx.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'Required unless MOCK_API' });
    }
    for (const key of [
      'S3_ENDPOINT',
      'S3_BUCKET',
      'S3_ACCESS_KEY_ID',
      'S3_SECRET_ACCESS_KEY',
    ] as const) {
      if (!env.MOCK_API && !env[key]) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'Required unless MOCK_API' });
      }
    }
    if (!env.SESSION_SECRET && (!env.MOCK_API || env.NODE_ENV === 'production')) {
      ctx.addIssue({ code: 'custom', path: ['SESSION_SECRET'], message: 'Required' });
    }
  })
  .transform((env) => ({ ...env, SESSION_SECRET: env.SESSION_SECRET ?? DEV_SESSION_SECRET }));

export type Env = z.infer<typeof EnvSchema>;

/** Reads and validates the environment once at startup, failing fast on anything missing. */
export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => EnvSchema.parse(source);
