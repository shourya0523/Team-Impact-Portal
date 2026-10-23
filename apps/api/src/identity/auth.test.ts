// TI-101 end to end, through Fastify and Better Auth against a real Postgres:
// every account type can sign up, verify its email and hold a session; under-13s are refused;
// 13 to 17 become teens who confirm a parent agreed; recruiters need a registered company domain;
// suspensions and deletions take effect at once; password reset signs out everywhere.
import { eq, sql } from 'drizzle-orm';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import type { Db } from '../db/client';
import * as schema from '../db/schema';
import { freshTestDatabase } from '../test/database';
import { createMemoryMailer } from './mailer';

const PORTAL = 'http://localhost:5173';
const PASSWORD = 'correct horse battery';
// argon2id hash of "team-impact-dev", the seed data's shared password.
const SEED_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$kwOXDCSVp3jrLCRhtryvcw$3F8TXsfX3cZ6DhEoMEoYr1C1B20F0TTfGItSyp1tal4';

let db: Db;
let closeDb: () => Promise<void>;
let app: Awaited<ReturnType<typeof buildApp>>;
const mailer = createMemoryMailer();

beforeAll(async () => {
  ({ db, close: closeDb } = await freshTestDatabase());
  app = await buildApp({
    sessionSecret: 's'.repeat(32),
    corsOrigins: [PORTAL],
    identity: {
      db,
      secret: 's'.repeat(32),
      baseURL: 'http://localhost:3000',
      links: { portalUrl: 'http://portal.test', athleteAppUrl: 'http://app.test' },
      mailer,
      production: false,
    },
  });
  // A protected route, as every real route will be: who does the API think is calling?
  app.get('/test/whoami', async (request, reply) => {
    const user = await app.authenticate(request);
    return user ?? reply.status(401).send({ error: 'unauthenticated' });
  });
});
afterAll(async () => {
  await app.close();
  await closeDb();
});
beforeEach(async () => {
  await db.execute(sql`truncate table users, orgs restart identity cascade`);
  mailer.sent.length = 0;
});

// Helpers ---------------------------------------------------------------------------------------

const post = (url: string, payload: object, headers: Record<string, string> = {}) =>
  app.inject({ method: 'POST', url, payload, headers: { origin: PORTAL, ...headers } });

const cookieOf = (res: LightMyRequestResponse) =>
  res.cookies.map((c) => `${c.name}=${c.value}`).join('; ');

const signUp = (overrides: Record<string, unknown> = {}) =>
  post('/api/auth/sign-up/email', {
    email: 'maya@tufts.edu',
    password: PASSWORD,
    name: 'Maya',
    lastName: 'Okafor',
    accountType: 'athlete',
    birthDate: '2004-03-14',
    acceptTerms: true,
    ...overrides,
  });

const signIn = (email = 'maya@tufts.edu', password = PASSWORD) =>
  post('/api/auth/sign-in/email', { email, password });

/** The link in the newest email to `to`. */
const linkTo = (to: string) => {
  const mail = mailer.sent.findLast((m) => m.to === to);
  if (!mail) throw new Error(`No email to ${to}`);
  const link = mail.text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error(`No link in "${mail.subject}"`);
  return new URL(link);
};

/** Opens the emailed link the way a browser would. */
const open = (link: URL) => app.inject({ method: 'GET', url: link.pathname + link.search });

const verifiedSignIn = async (
  email = 'maya@tufts.edu',
  overrides: Record<string, unknown> = {},
) => {
  expect((await signUp({ email, ...overrides })).statusCode).toBe(200);
  expect((await open(linkTo(email))).statusCode).toBe(302);
  const res = await signIn(email);
  expect(res.statusCode).toBe(200);
  return cookieOf(res);
};

const whoami = (cookie: string) =>
  app.inject({ method: 'GET', url: '/test/whoami', headers: { cookie } });

const userByEmail = async (email: string) =>
  (await db.select().from(schema.users).where(eq(schema.users.email, email)))[0];

const addCompany = async (domains: string[], status: 'active' | 'suspended' = 'active') => {
  const [org] = await db.insert(schema.orgs).values({ name: 'Northbeam', status }).returning();
  await db.insert(schema.orgDomains).values(domains.map((domain) => ({ orgId: org!.id, domain })));
  return org!;
};

// Sign-up ----------------------------------------------------------------------------------------

describe('sign-up', () => {
  it('creates an unverified account, records the terms, and emails a verification link', async () => {
    const res = await signUp();
    expect(res.statusCode).toBe(200);
    expect(res.cookies).toHaveLength(0); // no session until the email is verified

    const user = await userByEmail('maya@tufts.edu');
    expect(user).toMatchObject({
      firstName: 'Maya',
      lastName: 'Okafor',
      userType: 'athlete',
      dob: '2004-03-14',
      emailVerified: false,
      status: 'active',
    });
    const consents = await db
      .select({ flag: schema.consentRecords.flag, version: schema.consentRecords.termsVersion })
      .from(schema.consentRecords)
      .where(eq(schema.consentRecords.userId, user!.id));
    expect(consents).toEqual([{ flag: 'terms', version: 'v2.0' }]);

    const link = linkTo('maya@tufts.edu');
    expect(link.pathname).toBe('/api/auth/verify-email');
    expect(link.searchParams.get('callbackURL')).toBe('http://app.test/verified');
  });

  it('never sends the birth date back', async () => {
    const res = await signUp();
    expect(res.body).not.toContain('2004-03-14');
    expect(res.json().user).not.toHaveProperty('dob');
  });

  it('refuses under-13s and stores nothing', async () => {
    const res = await signUp({ birthDate: '2016-01-01' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: 'SIGNUP_REFUSED', field: 'birthDate' });
    expect(await userByEmail('maya@tufts.edu')).toBeUndefined();
    expect(mailer.sent).toHaveLength(0);
  });

  it('makes 13 to 17 year olds teens, and records that a parent agreed', async () => {
    const teen = { birthDate: '2011-05-01', accountType: 'teen' };
    expect((await signUp(teen)).json()).toMatchObject({ field: 'parentAgreed' });
    expect(
      (await signUp({ ...teen, accountType: 'athlete', parentAgreed: true })).json(),
    ).toMatchObject({ field: 'accountType' });

    expect((await signUp({ ...teen, parentAgreed: true })).statusCode).toBe(200);
    const user = await userByEmail('maya@tufts.edu');
    expect(user!.userType).toBe('teen');
    const flags = await db
      .select({ flag: schema.consentRecords.flag })
      .from(schema.consentRecords)
      .where(eq(schema.consentRecords.userId, user!.id));
    expect(flags.map((f) => f.flag).sort()).toEqual(['parent_agreed', 'terms']);
  });

  it('never lets anyone sign up as staff or a coach, or set server-owned fields', async () => {
    for (const accountType of ['staff', 'coach']) {
      const res = await signUp({ accountType });
      expect(res.statusCode, accountType).toBe(400);
    }
    // Status and company can't be chosen by the caller: Better Auth refuses the field itself.
    const org = await addCompany(['northbeam.com']);
    for (const extra of [{ status: 'active' }, { orgId: org.id }]) {
      const res = await signUp(extra);
      expect(res.statusCode, JSON.stringify(extra)).toBe(400);
      expect(res.json().code).toBe('FIELD_NOT_ALLOWED');
    }
    expect(await userByEmail('maya@tufts.edu')).toBeUndefined();
  });

  it('requires accepting the terms and a 12-character password', async () => {
    expect((await signUp({ acceptTerms: false })).statusCode).toBe(400);
    expect((await signUp({ password: 'short pass' })).statusCode).toBe(400);
    expect(await userByEmail('maya@tufts.edu')).toBeUndefined();
  });

  it('answers a taken email like a new one, and tells only the real owner', async () => {
    await signUp();
    mailer.sent.length = 0;
    const again = await signUp({ name: 'Mallory' });
    expect(again.statusCode).toBe(200);
    expect(await db.select().from(schema.users)).toHaveLength(1);
    const mail = mailer.sent.findLast((m) => m.to === 'maya@tufts.edu')!;
    expect(mail.subject).toMatch(/already have/);
    expect(mail.text).toContain('Hi Maya,'); // the owner, not the second sign-up's name
  });
});

describe('recruiter sign-up', () => {
  const recruiter = (email: string) => ({
    email,
    accountType: 'recruiter',
    birthDate: '1990-02-02',
  });

  it('admits an address on a registered domain, or a subdomain, and links the company', async () => {
    const org = await addCompany(['northbeam.com']);
    for (const email of ['sam@northbeam.com', 'jo@nyc.northbeam.com']) {
      expect((await signUp(recruiter(email))).statusCode, email).toBe(200);
      expect((await userByEmail(email))!.orgId, email).toBe(org.id);
    }
    expect(linkTo('sam@northbeam.com').searchParams.get('callbackURL')).toBe(
      'http://portal.test/verified',
    );
  });

  it('refuses personal, unregistered and suspended-company addresses', async () => {
    await addCompany(['gone.com'], 'suspended');
    for (const email of ['sam@gmail.com', 'sam@unknown.com', 'sam@gone.com', 'sam@notgone.com']) {
      const res = await signUp(recruiter(email));
      expect(res.statusCode, email).toBe(400);
      expect(res.json().field, email).toBe('email');
    }
    expect(await db.select().from(schema.users)).toHaveLength(0);
  });

  it('must be an adult', async () => {
    await addCompany(['northbeam.com']);
    const res = await signUp({ ...recruiter('sam@northbeam.com'), birthDate: '2010-01-01' });
    expect(res.statusCode).toBe(400);
  });
});

// Verification and sign-in ---------------------------------------------------------------------

describe('email verification and sign-in', () => {
  it('refuses sign-in until the email is verified, then holds a session', async () => {
    await signUp();
    const early = await signIn();
    expect(early.statusCode).toBe(403);
    expect(early.json().code).toBe('EMAIL_NOT_VERIFIED');

    const verified = await open(linkTo('maya@tufts.edu'));
    expect(verified.statusCode).toBe(302);
    expect(verified.headers.location).toBe('http://app.test/verified');
    const user = await userByEmail('maya@tufts.edu');
    expect(user).toMatchObject({ emailVerified: true });
    expect(user!.emailVerifiedAt).toBeInstanceOf(Date);

    const res = await signIn();
    expect(res.statusCode).toBe(200);
    const [cookie] = res.cookies;
    expect(cookie).toMatchObject({ name: 'ti.session_token', httpOnly: true, sameSite: 'Lax' });
    expect((await whoami(cookieOf(res))).json()).toEqual({ id: user!.id, userType: 'athlete' });
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    await verifiedSignIn();
    const wrong = await signIn('maya@tufts.edu', 'not my password!');
    const unknown = await signIn('ghost@tufts.edu');
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(unknown.json().code).toBe(wrong.json().code);
  });

  it('signs in accounts whose password came from the old users.password_hash (argon2)', async () => {
    // What migration 0002 and the seed produce: a credential account holding an argon2 hash.
    const [user] = await db
      .insert(schema.users)
      .values({
        email: 'coach@example.test',
        firstName: 'Dana',
        lastName: 'Lee',
        userType: 'coach',
        dob: '1985-01-01',
        emailVerified: true,
      })
      .returning();
    await db.insert(schema.authAccounts).values({
      userId: user!.id,
      accountId: user!.id,
      providerId: 'credential',
      password: SEED_HASH,
    });
    const res = await signIn('coach@example.test', 'team-impact-dev');
    expect(res.statusCode).toBe(200);
    expect((await whoami(cookieOf(res))).json().userType).toBe('coach');
  });

  it('401s a request with no session or a forged cookie', async () => {
    expect((await whoami('')).statusCode).toBe(401);
    expect((await whoami('ti.session_token=forged.value')).statusCode).toBe(401);
  });

  it('sign-out ends the session', async () => {
    const cookie = await verifiedSignIn();
    const out = await post('/api/auth/sign-out', {}, { cookie });
    expect(out.statusCode).toBe(200);
    expect((await whoami(cookie)).statusCode).toBe(401);
  });

  it('refuses requests from websites we don’t serve', async () => {
    await signUp();
    const res = await post(
      '/api/auth/sign-in/email',
      { email: 'maya@tufts.edu', password: PASSWORD },
      { origin: 'https://evil.example' },
    );
    expect(res.statusCode).toBe(403);
  });
});

// Suspension and deletion ------------------------------------------------------------------------

describe('suspension and deletion', () => {
  it('a suspended account can’t sign in, and its open sessions stop working at once', async () => {
    const cookie = await verifiedSignIn();
    await db
      .update(schema.users)
      .set({ status: 'suspended' })
      .where(eq(schema.users.email, 'maya@tufts.edu'));
    expect((await whoami(cookie)).statusCode).toBe(401);
    // Its sessions are gone, so Better Auth's own endpoints say "signed out" too.
    const session = await app.inject({
      method: 'GET',
      url: '/api/auth/get-session',
      headers: { cookie },
    });
    expect(session.json()).toBeNull();
    expect(await db.select().from(schema.authSessions)).toHaveLength(0);
    const res = await signIn();
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('ACCOUNT_SUSPENDED');
  });

  it('suspending a company locks out its recruiters', async () => {
    const org = await addCompany(['northbeam.com']);
    const cookie = await verifiedSignIn('sam@northbeam.com', {
      accountType: 'recruiter',
      birthDate: '1990-02-02',
    });
    expect((await whoami(cookie)).json().userType).toBe('recruiter');
    await db.update(schema.orgs).set({ status: 'suspended' }).where(eq(schema.orgs.id, org.id));
    expect((await whoami(cookie)).statusCode).toBe(401);
    expect((await signIn('sam@northbeam.com')).json().code).toBe('ACCOUNT_SUSPENDED');
  });

  it('a deleted account looks like no account at all', async () => {
    const cookie = await verifiedSignIn();
    await db
      .update(schema.users)
      .set({ deletedAt: new Date() })
      .where(eq(schema.users.email, 'maya@tufts.edu'));
    expect((await whoami(cookie)).statusCode).toBe(401);
    const res = await signIn();
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('INVALID_EMAIL_OR_PASSWORD');
  });
});

// Password reset ---------------------------------------------------------------------------------

describe('password reset', () => {
  const NEW_PASSWORD = 'a brand new passphrase';

  it('emails a link that lands on the reset page, sets a new password and signs out everywhere', async () => {
    const oldSession = await verifiedSignIn();
    const asked = await post('/api/auth/request-password-reset', {
      email: 'maya@tufts.edu',
      redirectTo: 'http://app.test/reset-password',
    });
    expect(asked.statusCode).toBe(200);

    // The link goes through the API, which forwards to the app's reset page with the token.
    const landing = await open(linkTo('maya@tufts.edu'));
    expect(landing.statusCode).toBe(302);
    const target = new URL(landing.headers.location as string);
    expect(target.origin + target.pathname).toBe('http://app.test/reset-password');
    const token = target.searchParams.get('token');
    expect(token).toBeTruthy();

    const reset = await post('/api/auth/reset-password', { token, newPassword: NEW_PASSWORD });
    expect(reset.statusCode).toBe(200);
    expect((await whoami(oldSession)).statusCode).toBe(401); // signed out everywhere
    expect((await signIn('maya@tufts.edu', PASSWORD)).statusCode).toBe(401);
    expect((await signIn('maya@tufts.edu', NEW_PASSWORD)).statusCode).toBe(200);

    // The link works once.
    const again = await post('/api/auth/reset-password', {
      token,
      newPassword: 'another passphrase',
    });
    expect(again.statusCode).toBe(400);
  });

  it('answers the same for an address with no account, and sends nothing', async () => {
    const res = await post('/api/auth/request-password-reset', { email: 'ghost@tufts.edu' });
    expect(res.statusCode).toBe(200);
    expect(mailer.sent).toHaveLength(0);
  });
});

describe('attack: choosing or changing your own account type or birth date', () => {
  it('can’t be done through Better Auth’s update-user endpoint, which is switched off', async () => {
    const cookie = await verifiedSignIn();
    for (const change of [{ userType: 'staff' }, { userType: 'coach' }, { dob: '1990-01-01' }]) {
      const res = await post('/api/auth/update-user', change, { cookie });
      expect(res.statusCode, JSON.stringify(change)).toBe(404);
    }
    const user = await userByEmail('maya@tufts.edu');
    expect(user).toMatchObject({ userType: 'athlete', dob: '2004-03-14' });
    expect((await whoami(cookie)).json().userType).toBe('athlete');
  });

  it('can’t be done at sign-up by sending the stored field names', async () => {
    for (const field of [{ userType: 'staff' }, { dob: '1990-01-01' }]) {
      const res = await signUp(field);
      expect(res.statusCode, JSON.stringify(field)).toBe(400);
      expect(res.json().code).toBe('FIELD_NOT_ALLOWED');
    }
    expect(await userByEmail('maya@tufts.edu')).toBeUndefined();
  });

  it('serves none of the account endpoints we don’t use', async () => {
    const cookie = await verifiedSignIn();
    for (const path of [
      '/api/auth/delete-user',
      '/api/auth/change-email',
      '/api/auth/update-session',
      '/api/auth/sign-in/social',
      '/api/auth/link-social',
    ]) {
      expect((await post(path, {}, { cookie })).statusCode, path).toBe(404);
    }
    // The account still exists and still signs in.
    expect((await whoami(cookie)).statusCode).toBe(200);
  });
});

describe('attack: stealing a session token from a page', () => {
  it('no response carries a session token, only the HttpOnly cookie does', async () => {
    await signUp();
    await open(linkTo('maya@tufts.edu'));
    const res = await signIn();
    expect(res.statusCode).toBe(200);
    expect(res.json()).not.toHaveProperty('token');
    const cookie = cookieOf(res);
    const token = res.cookies[0]!.value.split('.')[0]!;

    const session = await app.inject({
      method: 'GET',
      url: '/api/auth/get-session',
      headers: { cookie },
    });
    expect(session.statusCode).toBe(200);
    expect(session.json().session).not.toHaveProperty('token');
    const sessions = await app.inject({
      method: 'GET',
      url: '/api/auth/list-sessions',
      headers: { cookie },
    });
    expect(sessions.statusCode).toBe(200);
    for (const body of [res.body, session.body, sessions.body]) expect(body).not.toContain(token);
    // Revoking one session needs its token, so that endpoint is off; signing out still works.
    expect((await post('/api/auth/revoke-session', { token }, { cookie })).statusCode).toBe(404);
  });
});

describe('attack: dodging the rate limit', () => {
  /** A separate app with rate limiting on, as in production, and `trustProxy` proxy hops. */
  const limitedApp = async (trustProxy: number) =>
    buildApp({
      sessionSecret: 's'.repeat(32),
      corsOrigins: [PORTAL],
      trustProxy,
      identity: {
        db,
        secret: 's'.repeat(32),
        baseURL: 'http://localhost:3000',
        links: { portalUrl: 'http://portal.test', athleteAppUrl: 'http://app.test' },
        mailer,
        production: false,
        rateLimit: true,
      },
    });
  const attempt = (
    limited: Awaited<ReturnType<typeof limitedApp>>,
    remoteAddress: string,
    forwardedFor?: string,
  ) =>
    limited.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      remoteAddress,
      payload: { email: 'maya@tufts.edu', password: 'a wrong guess here' },
      headers: { origin: PORTAL, ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}) },
    });

  it('limits password guesses per caller, whatever IP they claim in headers', async () => {
    const limited = await limitedApp(0);
    const statuses = [];
    for (let i = 0; i < 23; i++) {
      statuses.push((await attempt(limited, '203.0.113.7', `198.51.100.${i}`)).statusCode);
    }
    // 20 a minute per caller, then refused, whatever IP each request claimed.
    expect(statuses.slice(0, 20).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(20)).toEqual([429, 429, 429]);
    // Someone else is unaffected.
    expect((await attempt(limited, '203.0.113.8')).statusCode).toBe(401);
    await limited.close();
  });

  it('behind our proxy, limits each real caller the proxy reports, separately', async () => {
    const limited = await limitedApp(1);
    const proxy = '10.0.0.2';
    for (let i = 0; i < 20; i++) await attempt(limited, proxy, '203.0.113.7');
    expect((await attempt(limited, proxy, '203.0.113.7')).statusCode).toBe(429);
    // A different user arriving through the same proxy has their own allowance.
    expect((await attempt(limited, proxy, '203.0.113.9')).statusCode).toBe(401);
    await limited.close();
  });
});

describe('hardening', () => {
  it('stores passwords as argon2id hashes, never as text', async () => {
    await signUp();
    const [account] = await db.select().from(schema.authAccounts);
    expect(account!.providerId).toBe('credential');
    expect(account!.password).toMatch(/^\$argon2id\$v=19\$m=65536,p=4,t=3\$/);
    expect(account!.password).not.toContain(PASSWORD);
  });

  it('a duplicate sign-up doesn’t reveal the real account', async () => {
    const first = await signUp();
    const second = await signUp();
    expect(second.statusCode).toBe(first.statusCode);
    expect(second.json().user.id).not.toBe((await userByEmail('maya@tufts.edu'))!.id);
  });

  it('a wrong password never emails the account owner', async () => {
    await signUp();
    mailer.sent.length = 0;
    expect((await signIn('maya@tufts.edu', 'not my password!')).statusCode).toBe(401);
    expect(mailer.sent).toHaveLength(0);
    // The right password on an unverified account does send a fresh link.
    expect((await signIn()).statusCode).toBe(403);
    expect(mailer.sent).toHaveLength(1);
  });

  it('refuses links edited to end on someone else’s site, before doing anything', async () => {
    await signUp();
    const real = linkTo('maya@tufts.edu');
    for (const target of [
      'https://evil.example/phish',
      '//evil.example/phish',
      'https://localhost:5173.evil.example',
      'javascript:alert(1)',
    ]) {
      const link = new URL(real);
      link.searchParams.set('callbackURL', target);
      const res = await open(link);
      expect(res.statusCode, target).toBe(400);
      expect(res.json().code).toBe('INVALID_REDIRECT');
    }
    // Nothing was verified by the edited links; the real one still works.
    expect((await userByEmail('maya@tufts.edu'))!.emailVerified).toBe(false);
    expect((await open(real)).headers.location).toBe('http://app.test/verified');
  });

  it('accepts our own landing pages, including the app’s deep-link scheme', async () => {
    await signUp();
    const link = linkTo('maya@tufts.edu');
    link.searchParams.set('callbackURL', 'teamimpact://verified');
    const res = await open(link);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('teamimpact://verified');
  });

  it('a reset email links only to our own app, whatever redirect the request asks for', async () => {
    await verifiedSignIn();
    mailer.sent.length = 0;
    const evil = await post('/api/auth/request-password-reset', {
      email: 'maya@tufts.edu',
      redirectTo: 'https://evil.example/steal',
    });
    // Refused outright, and nothing is sent.
    expect(evil.statusCode).toBe(400);
    expect(mailer.sent).toHaveLength(0);
    const ok = await post('/api/auth/request-password-reset', {
      email: 'maya@tufts.edu',
      redirectTo: 'http://app.test/reset-password',
    });
    expect(ok.statusCode).toBe(200);
    expect(mailer.sent.at(-1)!.text).not.toContain('evil.example');
  });

  it('uses Secure, __Secure- prefixed cookies in production', async () => {
    const prod = await buildApp({
      sessionSecret: 's'.repeat(32),
      corsOrigins: ['https://portal.teamimpact.org'],
      identity: {
        db,
        secret: 's'.repeat(32),
        baseURL: 'https://api.teamimpact.org',
        links: { portalUrl: 'https://portal.teamimpact.org', athleteAppUrl: 'https://app.test' },
        mailer,
        production: true,
      },
    });
    await signUp();
    await open(linkTo('maya@tufts.edu'));
    const res = await prod.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email: 'maya@tufts.edu', password: PASSWORD },
      headers: { origin: 'https://portal.teamimpact.org' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.cookies[0]).toMatchObject({
      name: '__Secure-ti.session_token',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    });
    await prod.close();
  });
});

describe('rate limits on emails', () => {
  it('sends at most 3 reset emails per caller every 5 minutes', async () => {
    const limited = await buildApp({
      sessionSecret: 's'.repeat(32),
      corsOrigins: [PORTAL],
      identity: {
        db,
        secret: 's'.repeat(32),
        baseURL: 'http://localhost:3000',
        links: { portalUrl: 'http://portal.test', athleteAppUrl: 'http://app.test' },
        mailer,
        production: false,
        rateLimit: true,
      },
    });
    const ask = () =>
      limited.inject({
        method: 'POST',
        url: '/api/auth/request-password-reset',
        remoteAddress: '203.0.113.50',
        payload: { email: 'anyone@tufts.edu' },
        headers: { origin: PORTAL },
      });
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await ask()).statusCode);
    expect(statuses).toEqual([200, 200, 200, 429]);
    await limited.close();
  });
});
