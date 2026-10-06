import { describe, expect, it } from 'vitest';
import { HealthResponse } from '@team-impact/contracts';
import { buildApp } from './app';

describe('api', () => {
  it('GET /health matches the shared contract', async () => {
    const app = await buildApp({ sessionSecret: 'x'.repeat(32), corsOrigins: [] });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(HealthResponse.parse(res.json()).status).toBe('ok');
    await app.close();
  });
});
