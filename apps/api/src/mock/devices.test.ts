import { afterEach, describe, expect, it } from 'vitest';
import { MAX_DEVICES_PER_USER, type Role } from '@team-impact/contracts';
import { buildApp } from '../app';

/** Expo's tokens look like this. */
const PHONE = 'ExponentPushToken[phone-0001]';
const TABLET = 'ExponentPushToken[tablet-0002]';

let closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(closers.map((c) => c()));
  closers = [];
});

type Method = 'POST' | 'DELETE';

/**
 * One mock API shared by several clients. The world isn't reachable from here, so whether a phone
 * is still registered is read back through `unregister`: 204 if it was yours, 404 if not.
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
      unregister: (token: string) => send('DELETE', '/me/devices', { token }, cookies),
    };
  };
  return { as, anonymous: send };
};

describe('push devices', () => {
  it('registers a phone, and registering it again keeps one entry', async () => {
    const athlete = await (await api()).as('athlete');
    expect(await athlete.register(PHONE)).toBe(204);
    expect(await athlete.register(PHONE)).toBe(204);
    expect(await athlete.unregister(PHONE)).toBe(204);
    expect(await athlete.unregister(PHONE)).toBe(404);
  });

  it('a phone belongs to whoever signed in on it last', async () => {
    const w = await api();
    const athlete = await w.as('athlete');
    const parent = await w.as('parent');
    await athlete.register(PHONE);
    await parent.register(PHONE);
    expect(await athlete.unregister(PHONE)).toBe(404);
    expect(await parent.unregister(PHONE)).toBe(204);
  });

  it('refuses anything but an Expo token, a web platform, or no sign-in', async () => {
    const w = await api();
    const athlete = await w.as('athlete');
    for (const token of [
      '',
      'not-a-token',
      'ExponentPushToken[]',
      'ExponentPushToken[has space]',
      `ExponentPushToken[${'x'.repeat(200)}]`,
    ]) {
      expect(await athlete.call('POST', '/me/devices', { token, platform: 'ios' }), token).toBe(
        400,
      );
    }
    expect(await athlete.register('ExpoPushToken[newer-format]')).toBe(204);
    expect(await athlete.call('POST', '/me/devices', { token: PHONE, platform: 'web' })).toBe(400);
    expect(await w.anonymous('POST', '/me/devices', { token: PHONE, platform: 'ios' })).toBe(401);
  });

  it(`keeps at most ${MAX_DEVICES_PER_USER} phones per account, dropping the oldest`, async () => {
    const w = await api();
    const athlete = await w.as('athlete');
    const parent = await w.as('parent');
    await parent.register(TABLET);
    const tokens = Array.from(
      { length: MAX_DEVICES_PER_USER + 2 },
      (_, n) => `ExponentPushToken[phone-${n}]`,
    );
    for (const token of tokens) expect(await athlete.register(token)).toBe(204);
    expect(await athlete.unregister(tokens[0]!)).toBe(404);
    expect(await athlete.unregister(tokens[1]!)).toBe(404);
    for (const token of tokens.slice(2)) expect(await athlete.unregister(token)).toBe(204);
    // Someone else's phones don't count toward the athlete's cap.
    expect(await parent.unregister(TABLET)).toBe(204);
  });

  it('re-registering a phone makes it the newest, so the cap drops another', async () => {
    const athlete = await (await api()).as('athlete');
    const tokens = Array.from(
      { length: MAX_DEVICES_PER_USER },
      (_, n) => `ExponentPushToken[phone-${n}]`,
    );
    for (const token of tokens) await athlete.register(token);
    await athlete.register(tokens[0]!);
    await athlete.register('ExponentPushToken[one-more]');
    expect(await athlete.unregister(tokens[0]!)).toBe(204);
    expect(await athlete.unregister(tokens[1]!)).toBe(404);
  });

  it('takes the token to unregister in the body, never the path', async () => {
    const athlete = await (await api()).as('athlete');
    await athlete.register(PHONE);
    expect(await athlete.call('DELETE', `/me/devices/${encodeURIComponent(PHONE)}`)).toBe(404);
    expect(await athlete.call('DELETE', '/me/devices')).toBe(400);
    expect(await athlete.unregister(PHONE)).toBe(204);
  });

  it('signing out with a token removes only that phone', async () => {
    const athlete = await (await api()).as('athlete');
    await athlete.register(PHONE);
    await athlete.register(TABLET);
    expect(await athlete.call('POST', '/auth/sign-out', { token: PHONE })).toBe(204);
    expect(await athlete.unregister(PHONE)).toBe(404);
    expect(await athlete.unregister(TABLET)).toBe(204);
  });

  it('signing out works with no body (the portal) and with no session', async () => {
    const w = await api();
    const athlete = await w.as('athlete');
    await athlete.register(PHONE);
    expect(await athlete.call('POST', '/auth/sign-out')).toBe(204);
    expect(await w.anonymous('POST', '/auth/sign-out', { token: PHONE })).toBe(204);
    expect(await athlete.unregister(PHONE)).toBe(404);
  });
});
