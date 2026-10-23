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
    // Auth (TI-101). Where the API is reached: emailed links point here first.
    API_URL: z.url().default('http://localhost:3000'),
    // Where those links land afterwards: recruiters and staff on the portal, everyone else the app.
    PORTAL_URL: z.url().default('http://localhost:5173'),
    ATHLETE_APP_URL: z.url().default('http://localhost:8081'),
    // Unset in development: emails are printed to the API log instead of sent.
    SMTP_URL: z.url().optional(),
    MAIL_FROM: z.string().min(3).default('Team Impact <no-reply@localhost>'),
    // Proxies in front of the API (1 on DigitalOcean App Platform). Rate limits key on the caller's
    // IP, so it must come from our proxy, not from a header anyone can send. 0 when reached directly.
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    FLAG_IDENTITY_SEARCH: z.stringbool().default(true),
    FLAG_MEDICAL_COMMUNITIES: z.stringbool().default(true),
  })
  .superRefine((env, ctx) => {
    if (!env.MOCK_API && !env.DATABASE_URL) {
      ctx.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'Required unless MOCK_API' });
    }
    if (!env.SESSION_SECRET && (!env.MOCK_API || env.NODE_ENV === 'production')) {
      ctx.addIssue({ code: 'custom', path: ['SESSION_SECRET'], message: 'Required' });
    }
    // Verification and reset emails must really go out; the log mailer is for development.
    if (env.NODE_ENV === 'production' && !env.MOCK_API && !env.SMTP_URL) {
      ctx.addIssue({ code: 'custom', path: ['SMTP_URL'], message: 'Required in production' });
    }
  })
  .transform((env) => ({ ...env, SESSION_SECRET: env.SESSION_SECRET ?? DEV_SESSION_SECRET }));

export type Env = z.infer<typeof EnvSchema>;

/** Reads and validates the environment once at startup, failing fast on anything missing. */
export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => EnvSchema.parse(source);
