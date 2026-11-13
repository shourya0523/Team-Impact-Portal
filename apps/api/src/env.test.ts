import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

describe('env', () => {
  it('runs on mocks without a database or session secret in development', () => {
    const env = loadEnv({ MOCK_API: '1' });
    expect(env.MOCK_API).toBe(true);
    expect(env.SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it('needs a database and a session secret otherwise', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ MOCK_API: '1', NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/);
  });

  it('serves the dev outbox only when asked for, and never in production', () => {
    expect(loadEnv({ MOCK_API: '1' }).DEV_OUTBOX).toBe(false);
    expect(
      loadEnv({ MOCK_API: '1', NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32) }),
    ).toMatchObject({ DEV_OUTBOX: false });
    expect(loadEnv({ MOCK_API: '1', DEV_OUTBOX: '1' }).DEV_OUTBOX).toBe(true);
    expect(() =>
      loadEnv({
        MOCK_API: '1',
        DEV_OUTBOX: '1',
        NODE_ENV: 'production',
        SESSION_SECRET: 'x'.repeat(32),
      }),
    ).toThrow(/DEV_OUTBOX/);
  });

  it('turns the flags off from the environment', () => {
    const env = loadEnv({ MOCK_API: '1', FLAG_MEDICAL_COMMUNITIES: 'false' });
    expect(env.FLAG_MEDICAL_COMMUNITIES).toBe(false);
    expect(env.FLAG_IDENTITY_SEARCH).toBe(true);
  });
});
