import { afterEach, describe, expect, it } from 'vitest';
import type { Role } from '@team-impact/contracts';
import { buildApp } from '../app';

/** Expo's tokens look like this, brackets and all, so the DELETE path has to be URL-encoded. */
const PHONE = 'ExponentPushToken[phone-0001]';
const TABLET = 'ExponentPushToken[tablet-0002]';
const path = (token: string) => `/me/devices/${encodeURIComponent(token)}`;

let closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(closers.map((c) => c()));
  closers = [];
});

type Method = 'POST' | 'DELETE';

/**
 * One mock API shared by several clients. The world isn't reachable from here, so whether a phone
 * is still registered is read back through DELETE: 204 if it was yours, 404 if not.
 */
const api = async () => {
  const app = await buildApp({ sessionSecret: 'x'.repeat(32), corsOrigins: [], mock: true });
  closers.push(() => app.close());
  const send = async (method: Method, url: string, payload?: object, cookies?: object) =>
    (await app.inject({ method, url, ...(payload ? { payload } : {}), cookies: { ...cookies } }))
      .statusCode;
  const as = async (role: Role) => {
    const res = await app.inject({ method: 'POST', url: '/auth/dev-sign-in', payload: { role } });
    expect(res.statusCode).toBe(200);
    const cookie = res.cookies[0]!;
    const cookies = { [cookie.name]: cookie.value };
    return {
      call: (method: Method, url: string, payload?: object) => send(method, url, payload, cookies),
      register: (token: string) => send('POST', '/me/devices', { token, platform: 'ios' }, cookies),
    };
  };
  return { as, anonymous: send };
};

describe('push devices', () => {
  it('registers a phone, and registering it again keeps one entry', async () => {
    const athlete = await (await api()).as('athlete');
    expect(await athlete.register(PHONE)).toBe(204);
    expect(await athlete.register(PHONE)).toBe(204);
    expect(await athlete.call('DELETE', path(PHONE))).toBe(204);
    expect(await athlete.call('DELETE', path(PHONE))).toBe(404);
  });

  it('a phone belongs to whoever signed in on it last', async () => {
    const w = await api();
    const athlete = await w.as('athlete');
    const parent = await w.as('parent');
    await athlete.register(PHONE);
    await parent.register(PHONE);
    expect(await athlete.call('DELETE', path(PHONE))).toBe(404);
    expect(await parent.call('DELETE', path(PHONE))).toBe(204);
  });

  it('refuses an empty token, a web platform, or no sign-in', async () => {
    const w = await api();
    const athlete = await w.as('athlete');
    expect(await athlete.call('POST', '/me/devices', { token: '', platform: 'ios' })).toBe(400);
    expect(await athlete.call('POST', '/me/devices', { token: PHONE, platform: 'web' })).toBe(400);
    expect(await w.anonymous('POST', '/me/devices', { token: PHONE, platform: 'ios' })).toBe(401);
  });

  it('signing out with a token removes only that phone', async () => {
    const athlete = await (await api()).as('athlete');
    await athlete.register(PHONE);
    await athlete.register(TABLET);
    expect(await athlete.call('POST', '/auth/sign-out', { token: PHONE })).toBe(204);
    expect(await athlete.call('DELETE', path(PHONE))).toBe(404);
    expect(await athlete.call('DELETE', path(TABLET))).toBe(204);
  });

  it('signing out works with no body (the portal) and with no session', async () => {
    const w = await api();
    const athlete = await w.as('athlete');
    await athlete.register(PHONE);
    expect(await athlete.call('POST', '/auth/sign-out')).toBe(204);
    expect(await w.anonymous('POST', '/auth/sign-out', { token: PHONE })).toBe(204);
    expect(await athlete.call('DELETE', path(PHONE))).toBe(404);
  });
});
