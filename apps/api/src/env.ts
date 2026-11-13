import { z } from 'zod';
import { DEFAULT_THRESHOLDS } from './moderation';

/** Only for local mock runs, where nothing real is signed. */
const DEV_SESSION_SECRET = 'mock-api-session-secret-not-for-real-use';

/** Where emailed links point in development. In production each must be set (see below). */
const DEV_URLS = {
  API_URL: 'http://localhost:3000',
  PORTAL_URL: 'http://localhost:5173',
  ATHLETE_APP_URL: 'http://localhost:8081',
};

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
    /**
     * Mock only: serve `GET /dev/outbox` and print sent email, invite links included, so they can
     * be opened locally. Off unless asked for (`pnpm dev:mock` sets it), and refused in production.
     */
    DEV_OUTBOX: z.stringbool().default(false),
    // Auth (TI-101). Where the API is reached: emailed links point here first.
    API_URL: z.url().optional(),
    // Where those links land afterwards: recruiters and staff on the portal, everyone else the app.
    PORTAL_URL: z.url().optional(),
    ATHLETE_APP_URL: z.url().optional(),
    // Unset in development: emails are printed to the API log instead of sent.
    SMTP_URL: z.url().optional(),
    MAIL_FROM: z.string().min(3).default('Team Impact <no-reply@localhost>'),
    // Proxies in front of the API (1 on DigitalOcean App Platform). Rate limits key on the caller's
    // IP, so it must come from our proxy, not from a header anyone can send. 0 when reached directly.
    // Required in production (see below).
    TRUST_PROXY: z.coerce.number().int().min(0).optional(),
    FLAG_IDENTITY_SEARCH: z.stringbool().default(true),
    FLAG_MEDICAL_COMMUNITIES: z.stringbool().default(true),
    /**
     * OpenAI key. Its presence turns on moderation screening of new content (without it, everything
     * waits for staff). Resumes only go to OpenAI when `RESUME_LLM=openai` too.
     */
    OPENAI_API_KEY: z.string().min(1).optional(),
    /**
     * OpenAI category scores (0 to 1). Content OpenAI flags, or scoring `MODERATION_HOLD_AT` or
     * more, is held for staff; flagged content scoring `MODERATION_BLOCK_AT` or more is blocked.
     */
    MODERATION_HOLD_AT: z.coerce.number().min(0).max(1).default(DEFAULT_THRESHOLDS.holdAt),
    MODERATION_BLOCK_AT: z.coerce.number().min(0).max(1).default(DEFAULT_THRESHOLDS.blockAt),
    /**
     * Resume reading (TI-113). The open-source layout reader always runs. `openai` adds a grounded
     * LLM pass, which sends resume text (contacts stripped) to OpenAI: off unless Team Impact opts in.
     */
    RESUME_LLM: z.enum(['off', 'openai']).default('off'),
    RESUME_LLM_MODEL: z.string().min(1).optional(),
    OPENAI_BASE_URL: z.url().optional(),
    /** docling-serve sidecar for photos and scans; without it they fall back to typing the card in. */
    DOCLING_URL: z.url().optional(),
    DOCLING_API_KEY: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (!env.MOCK_API && !env.DATABASE_URL) {
      ctx.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'Required unless MOCK_API' });
    }
    if (env.RESUME_LLM === 'openai' && !env.OPENAI_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['OPENAI_API_KEY'],
        message: 'Required when RESUME_LLM=openai',
      });
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
    if (env.DEV_OUTBOX && env.NODE_ENV === 'production') {
      ctx.addIssue({ code: 'custom', path: ['DEV_OUTBOX'], message: 'Never in production' });
    }
    // Verification and reset emails must really go out; the log mailer is for development.
    if (env.NODE_ENV === 'production' && !env.MOCK_API && !env.SMTP_URL) {
      ctx.addIssue({ code: 'custom', path: ['SMTP_URL'], message: 'Required in production' });
    }
    // A forgotten one would send real users verification and reset links to localhost.
    if (env.NODE_ENV === 'production' && !env.MOCK_API) {
      for (const key of Object.keys(DEV_URLS) as (keyof typeof DEV_URLS)[]) {
        if (!env[key])
          ctx.addIssue({ code: 'custom', path: [key], message: 'Required in production' });
      }
      // Behind App Platform's proxy every request arrives from the proxy's address. Trusting no
      // hops would put every caller on one IP, and the sign-in limit would lock out everyone.
      if (!env.TRUST_PROXY) {
        ctx.addIssue({
          code: 'custom',
          path: ['TRUST_PROXY'],
          message:
            'Required in production: the number of proxies in front of the API (1 on App Platform)',
        });
      }
    }
  })
  .transform((env) => ({
    ...env,
    SESSION_SECRET: env.SESSION_SECRET ?? DEV_SESSION_SECRET,
    API_URL: env.API_URL ?? DEV_URLS.API_URL,
    PORTAL_URL: env.PORTAL_URL ?? DEV_URLS.PORTAL_URL,
    ATHLETE_APP_URL: env.ATHLETE_APP_URL ?? DEV_URLS.ATHLETE_APP_URL,
    TRUST_PROXY: env.TRUST_PROXY ?? 0,
  }));

export type Env = z.infer<typeof EnvSchema>;

/** Reads and validates the environment once at startup, failing fast on anything missing. */
export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => EnvSchema.parse(source);
