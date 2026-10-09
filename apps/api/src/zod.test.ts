import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import {
  ApiError,
  CardFace,
  HealthResponse,
  LoginRequest,
  type MyCard,
  PageQuery,
} from '@team-impact/contracts';
import { useZodContracts } from './zod';

const ID = '7f1d6a2e-3b4c-4d5e-8f60-123456789abc';

const myCard: MyCard = {
  id: ID,
  athleteId: ID,
  season: 2026,
  team: null,
  photoUrl: null,
  firstName: 'Maya',
  lastName: 'Okafor',
  jerseyNumber: '07',
  position: null,
  classYear: 2028,
  major: 'Economics',
  hometown: null,
  city: null,
  region: null,
  experience: null,
  skills: [],
  lookingFor: null,
  contact: { email: 'maya@tufts.edu', phone: '(401) 555-0119', linkedinUrl: null },
  visibility: {
    published: true,
    openToRecruiting: false,
    familiesSee: { email: true, phone: true, linkedin: false },
    recruitersSee: { email: false, phone: false, linkedin: false },
  },
  isCurrent: true,
  updatedAt: '2026-10-08T12:00:00.000Z',
};

const buildTestApp = () => {
  const app = useZodContracts(Fastify());
  app.post('/login', { schema: { body: LoginRequest } }, async (request) => ({
    email: request.body.email,
  }));
  app.get('/items', { schema: { querystring: PageQuery } }, async (request) => ({
    limit: request.query.limit,
  }));
  // A handler that has the full card but serves the teen view.
  app.get('/teen-card', { schema: { response: { 200: CardFace } } }, async () => myCard);
  app.get('/broken', { schema: { response: { 200: HealthResponse } } }, async () => {
    return { status: 'ok', version: 1 } as unknown as HealthResponse;
  });
  app.get('/throws', async () => {
    throw new Error('database password is hunter2');
  });
  return app;
};

describe('zod contracts', () => {
  it('rejects a bad body with the shared error shape', async () => {
    const res = await buildTestApp().inject({
      method: 'POST',
      url: '/login',
      payload: { email: 'not-an-email', password: '' },
    });
    expect(res.statusCode).toBe(400);
    const { error } = ApiError.parse(res.json());
    expect(error.code).toBe('validation_error');
    expect(error.issues?.map((issue) => issue.path)).toEqual([
      ['body', 'email'],
      ['body', 'password'],
    ]);
  });

  it('hands handlers the parsed request', async () => {
    const app = buildTestApp();
    const login = await app.inject({
      method: 'POST',
      url: '/login',
      payload: { email: 'Jane@Example.com', password: 'x' },
    });
    expect(login.json()).toEqual({ email: 'jane@example.com' });
    const items = await app.inject({ method: 'GET', url: '/items?limit=5' });
    expect(items.json()).toEqual({ limit: 5 });
  });

  it('drops fields the response schema does not list', async () => {
    const res = await buildTestApp().inject({ method: 'GET', url: '/teen-card' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).not.toHaveProperty('contact');
    expect(res.json()).not.toHaveProperty('visibility');
    expect(res.json().firstName).toBe('Maya');
  });

  it('refuses to send a response that breaks its contract', async () => {
    const res = await buildTestApp().inject({ method: 'GET', url: '/broken' });
    expect(res.statusCode).toBe(500);
    expect(ApiError.parse(res.json()).error.code).toBe('internal_error');
  });

  it('hides internal error details', async () => {
    const res = await buildTestApp().inject({ method: 'GET', url: '/throws' });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('hunter2');
  });

  it('uses the shared shape for malformed JSON and unknown routes', async () => {
    const app = buildTestApp();
    const badJson = await app.inject({
      method: 'POST',
      url: '/login',
      headers: { 'content-type': 'application/json' },
      payload: '{"email":',
    });
    expect(badJson.statusCode).toBe(400);
    expect(ApiError.parse(badJson.json()).error.code).toBe('bad_request');

    const missing = await app.inject({ method: 'GET', url: '/nope' });
    expect(missing.statusCode).toBe(404);
    expect(ApiError.parse(missing.json()).error.code).toBe('not_found');
  });
});
