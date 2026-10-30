import { randomUUID } from 'node:crypto';
import cookie from '@fastify/cookie';
import Fastify, { type InjectOptions } from 'fastify';
import { expect } from 'vitest';
import type { FeatureFlags, Me, Role } from '@team-impact/contracts';
import { buildApp } from '../app';
import { users } from '../db/schema';
import { registerMockRoutes } from '../mock/routes';
import { MockWorld } from '../mock/world';
import { useZodContracts, type ZodApp } from '../zod';
import type { TestDb } from './db';

/**
 * One-line test users (TI-89).
 *
 *     const { app, world } = await mockApp();
 *     const parent = await signInAs(app, 'parent');
 *     const res = await parent.get('/me');
 *
 * Real login (argon2 + signed cookies) isn't built yet, so on the mock API `signInAs` uses dev
 * sign-in: the fixture user for `role`, with the same signed session cookie real sign-in will set.
 * On the database app, `dbUserAs` inserts a user of that role and the app reads who is signed in
 * from a test-only header (passed through `buildApp`'s `currentUserId`, never in production).
 */

export const SESSION_SECRET = 'x'.repeat(32);
const ALL_ON: FeatureFlags = { identitySearch: true, medicalCommunities: true };

type App = ZodApp;
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface Res {
  status: number;
  /** Parsed JSON, or undefined for an empty body. */
  body: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- assertions read freely
  text: string;
}

/** Calls the app as one person: their cookies (updated by responses) or test header ride along. */
export interface Agent {
  get: (url: string) => Promise<Res>;
  post: (url: string, payload?: object) => Promise<Res>;
  put: (url: string, payload?: object) => Promise<Res>;
  patch: (url: string, payload?: object) => Promise<Res>;
  delete: (url: string, payload?: object) => Promise<Res>;
  call: (method: Method, url: string, payload?: object) => Promise<Res>;
}

const agentFor = (app: App, headers: Record<string, string> = {}): Agent => {
  let cookies: Record<string, string> = {};
  const call = async (method: Method, url: string, payload?: object) => {
    const options: InjectOptions = { method, url, cookies, headers };
    if (payload !== undefined) options.payload = payload;
    const r = await app.inject(options);
    for (const c of r.cookies) cookies = { ...cookies, [c.name]: c.value };
    return { status: r.statusCode, body: r.body ? r.json() : undefined, text: r.body };
  };
  return {
    call,
    get: (url) => call('GET', url),
    post: (url, payload) => call('POST', url, payload ?? {}),
    put: (url, payload) => call('PUT', url, payload ?? {}),
    patch: (url, payload) => call('PATCH', url, payload ?? {}),
    delete: (url, payload) => call('DELETE', url, payload),
  };
};

/**
 * The mock API (MOCK_API=1) on a world the test can read and change; each call gets its own
 * world. Close it when the test is done (`afterEach`).
 */
export const mockApp = async ({ flags = ALL_ON }: { flags?: FeatureFlags } = {}) => {
  const world = new MockWorld(flags);
  const app = useZodContracts(Fastify());
  await app.register(cookie, { secret: SESSION_SECRET });
  registerMockRoutes(app, world);
  await app.ready();
  return { app, world, close: () => app.close() };
};

/** Someone with no session: sign-up, previews, and checks that a route refuses strangers. */
export const anonymous = (app: App): Agent => agentFor(app);

/** Signs in as `role`'s fixture user on a mock app; `newcomer` picks one on no team yet. */
export const signInAs = async (
  app: App,
  role: Role,
  { newcomer = false }: { newcomer?: boolean } = {},
): Promise<Agent & { me: Me }> => {
  const agent = agentFor(app);
  const res = await agent.post('/auth/dev-sign-in', { role, newcomer });
  expect(res.status, `dev sign-in as ${role}`).toBe(200);
  return { ...agent, me: res.body as Me };
};

// Database app -------------------------------------------------------------------------------------

const TEST_USER_HEADER = 'x-test-user-id';

/** The database app, reading who is signed in from the test-only header `dbUserAs` sets. */
export const dbApp = (testDb: TestDb, { flags = ALL_ON }: { flags?: FeatureFlags } = {}) =>
  buildApp({
    sessionSecret: SESSION_SECRET,
    corsOrigins: [],
    db: testDb.db,
    flags,
    currentUserId: async (request) => {
      const id = request.headers[TEST_USER_HEADER];
      return typeof id === 'string' ? id : null;
    },
  });

type UserType = (typeof users.userType.enumValues)[number];

/** Inserts a user of `userType` and returns an agent signed in as them, plus their id. */
export const dbUserAs = async (
  app: App,
  testDb: TestDb,
  userType: UserType,
  fields: Partial<typeof users.$inferInsert> = {},
): Promise<Agent & { id: string }> => {
  const [row] = await testDb.db
    .insert(users)
    .values({
      email: `${randomUUID()}@example.com`,
      passwordHash: 'x',
      firstName: 'Test',
      lastName: userType,
      dob: userType === 'teen' ? '2011-05-01' : '2000-05-06',
      userType,
      ...fields,
    })
    .returning({ id: users.id });
  const id = row!.id;
  return { ...agentFor(app, { [TEST_USER_HEADER]: id }), id };
};
