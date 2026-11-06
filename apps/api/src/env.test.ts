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

  it('requires SMTP and every emailed-link URL on the real API in production', () => {
    const prod = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://db.test/app',
      SESSION_SECRET: 's'.repeat(32),
      SMTP_URL: 'smtp://mail.test',
      API_URL: 'https://api.teamimpact.org',
      PORTAL_URL: 'https://portal.teamimpact.org',
      ATHLETE_APP_URL: 'https://app.teamimpact.org',
    };
    expect(loadEnv(prod).PORTAL_URL).toBe('https://portal.teamimpact.org');
    for (const key of ['SMTP_URL', 'API_URL', 'PORTAL_URL', 'ATHLETE_APP_URL'] as const) {
      expect(() => loadEnv({ ...prod, [key]: undefined })).toThrow(new RegExp(key));
    }
  });

  it('points emailed links at localhost in development', () => {
    const env = loadEnv({ DATABASE_URL: 'postgres://db.test/app', SESSION_SECRET: 's'.repeat(32) });
    expect([env.API_URL, env.PORTAL_URL, env.ATHLETE_APP_URL]).toEqual([
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8081',
    ]);
  });

  it('turns the flags off from the environment', () => {
    const env = loadEnv({ MOCK_API: '1', FLAG_MEDICAL_COMMUNITIES: 'false' });
    expect(env.FLAG_MEDICAL_COMMUNITIES).toBe(false);
    expect(env.FLAG_IDENTITY_SEARCH).toBe(true);
  });
});
