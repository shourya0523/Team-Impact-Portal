import { describe, expect, it } from 'vitest';
import { HealthResponse } from '@team-impact/contracts';
import { buildApp } from './app';
import { createTestDb } from './test/db';

// Booting PGlite and running the migrations can take over 5s on a busy CI runner.
const DB_TIMEOUT_MS = 30_000;

describe('api', () => {
  it(
    'GET /health matches the shared contract',
    async () => {
      const { db, close } = await createTestDb();
      const app = await buildApp({ sessionSecret: 'x'.repeat(32), corsOrigins: [], db });
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      expect(HealthResponse.parse(res.json()).status).toBe('ok');
      await app.close();
      await close();
    },
    DB_TIMEOUT_MS,
  );

  it('lets the athlete app on web send PUT requests across origins', async () => {
    const origin = 'http://localhost:8081';
    const app = await buildApp({ sessionSecret: 'x'.repeat(32), corsOrigins: [origin] });
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: { origin, 'access-control-request-method': 'PUT' },
    });
    expect(res.headers['access-control-allow-methods']).toContain('PUT');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    await app.close();
  });
});
