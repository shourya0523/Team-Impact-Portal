import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  SESSION_SECRET: z.string().min(32),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((value) => value.split(',').map((origin) => origin.trim())),
});

export type Env = z.infer<typeof EnvSchema>;

/** Reads and validates the environment once at startup, failing fast on anything missing. */
export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => EnvSchema.parse(source);
