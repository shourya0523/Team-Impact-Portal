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

  it('turns the flags off from the environment', () => {
    const env = loadEnv({ MOCK_API: '1', FLAG_MEDICAL_COMMUNITIES: 'false' });
    expect(env.FLAG_MEDICAL_COMMUNITIES).toBe(false);
    expect(env.FLAG_IDENTITY_SEARCH).toBe(true);
  });

  it('screens only with an OpenAI key, and keeps the hold threshold at or under the block one', () => {
    const env = loadEnv({ MOCK_API: '1' });
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.MODERATION_HOLD_AT).toBeLessThan(env.MODERATION_BLOCK_AT);
    expect(() =>
      loadEnv({ MOCK_API: '1', MODERATION_HOLD_AT: '0.9', MODERATION_BLOCK_AT: '0.5' }),
    ).toThrow(/MODERATION_HOLD_AT/);
  });
});
