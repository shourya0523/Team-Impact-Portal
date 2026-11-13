import { z } from 'zod';
import { DEFAULT_THRESHOLDS } from './moderation';

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
    /** How long product events are kept in events_log before the daily prune deletes them. */
    EVENTS_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(365),
    CORS_ORIGINS: z
      .string()
      // The portal (Vite) and the athlete app on web (Expo).
      .default('http://localhost:5173,http://localhost:8081')
      .transform((value) => value.split(',').map((origin) => origin.trim())),
    FLAG_IDENTITY_SEARCH: z.stringbool().default(true),
    FLAG_MEDICAL_COMMUNITIES: z.stringbool().default(true),
    /** Screens new content with OpenAI moderation. Without it, everything waits for staff. */
    OPENAI_API_KEY: z.string().min(1).optional(),
    /**
     * OpenAI category scores (0 to 1). Content OpenAI flags, or scoring `MODERATION_HOLD_AT` or
     * more, is held for staff; flagged content scoring `MODERATION_BLOCK_AT` or more is blocked.
     */
    MODERATION_HOLD_AT: z.coerce.number().min(0).max(1).default(DEFAULT_THRESHOLDS.holdAt),
    MODERATION_BLOCK_AT: z.coerce.number().min(0).max(1).default(DEFAULT_THRESHOLDS.blockAt),
  })
  .superRefine((env, ctx) => {
    if (!env.MOCK_API && !env.DATABASE_URL) {
      ctx.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'Required unless MOCK_API' });
    }
    if (!env.SESSION_SECRET && (!env.MOCK_API || env.NODE_ENV === 'production')) {
      ctx.addIssue({ code: 'custom', path: ['SESSION_SECRET'], message: 'Required' });
    }
    if (env.MODERATION_HOLD_AT > env.MODERATION_BLOCK_AT) {
      ctx.addIssue({
        code: 'custom',
        path: ['MODERATION_HOLD_AT'],
        message: 'Must not be above MODERATION_BLOCK_AT',
      });
    }
  })
  .transform((env) => ({ ...env, SESSION_SECRET: env.SESSION_SECRET ?? DEV_SESSION_SECRET }));

export type Env = z.infer<typeof EnvSchema>;

/** Reads and validates the environment once at startup, failing fast on anything missing. */
export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => EnvSchema.parse(source);
