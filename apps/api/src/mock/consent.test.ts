// Contact and visibility settings: every privacy choice is kept as a timestamped consent record
// (PRD §6, §7), read back through GET /me/consent-history.
import { afterEach, describe, expect, it } from 'vitest';
import { type ConsentRecord, consentFlags, type Role } from '@team-impact/contracts';
import { buildApp } from '../app';
import { id } from './fixtures';

const FIRST_GEN = id(304); // official interest community; Jordan and Priya opted in to being findable
const FINANCE = id(305); // open interest community

let close: (() => Promise<void>) | undefined;
afterEach(() => close?.());

/** One mock API; `as(role)` signs a fixture user in, so several viewers share one world. */
const world = async () => {
  const app = await buildApp({ sessionSecret: 'x'.repeat(32), corsOrigins: [], mock: true });
  close = () => app.close();
  const as = async (role: Role, newcomer = false) => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/dev-sign-in',
      payload: { role, newcomer },
    });
    expect(res.statusCode).toBe(200);
    const cookie = res.cookies[0]!;
    const cookies = { [cookie.name]: cookie.value };
    const call = async (method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) => {
      const r = await app.inject({ method, url, payload, cookies });
      return { status: r.statusCode, body: r.json() };
    };
    return {
      get: (url: string) => call('GET', url),
      post: (url: string, payload: object = {}) => call('POST', url, payload),
      put: (url: string, payload: object) => call('PUT', url, payload),
      /** The signed-in user's consent history, newest first. */
      history: async () => (await call('GET', '/me/consent-history')).body as ConsentRecord[],
    };
  };
  return { as };
};

/** Just flag and value, oldest first, for readable assertions. */
const choices = (records: ConsentRecord[]) =>
  [...records].reverse().map(({ flag, value }) => [flag, value]);

describe('consent records: contact sharing', () => {
  it('records each changed channel for families and recruiters, with a timestamp', async () => {
    const { as } = await world();
    const jordan = await as('athlete');
    expect(await jordan.history()).toEqual([]);

    const before = (await jordan.get('/me/settings')).body;
    const res = await jordan.put('/me/settings', {
      familiesSee: { phone: !before.familiesSee.phone },
      recruitersSee: {
        email: !before.recruitersSee.email,
        linkedin: !before.recruitersSee.linkedin,
      },
    });
    expect(res.status).toBe(200);

    const history = await jordan.history();
    expect(choices(history)).toEqual([
      [consentFlags.familiesSee('phone'), !before.familiesSee.phone],
      [consentFlags.recruitersSee('email'), !before.recruitersSee.email],
      [consentFlags.recruitersSee('linkedin'), !before.recruitersSee.linkedin],
    ]);
    for (const r of history) expect(new Date(r.recordedAt).toISOString()).toBe(r.recordedAt);
  });

  it('records nothing when a value is sent unchanged, or only contact details change', async () => {
    const { as } = await world();
    const jordan = await as('athlete');
    const before = (await jordan.get('/me/settings')).body;
    await jordan.put('/me/settings', {
      familiesSee: before.familiesSee,
      recruitersSee: before.recruitersSee,
      openToRecruiting: before.openToRecruiting.on,
      contact: { phone: '(617) 555-0100' },
    });
    expect(await jordan.history()).toEqual([]);
  });

  it('records nothing for a refused change', async () => {
    const { as } = await world();
    const leo = await as('athlete', true); // no published card yet
    expect((await leo.put('/me/settings', { openToRecruiting: true })).status).toBe(400);
    expect(await leo.history()).toEqual([]);
  });

  it('keeps the whole history, newest first: the latest record is the current value', async () => {
    const { as } = await world();
    const jordan = await as('athlete');
    const start = (await jordan.get('/me/settings')).body.familiesSee.email as boolean;
    for (const on of [!start, start, !start]) {
      await jordan.put('/me/settings', { familiesSee: { email: on } });
    }
    const history = await jordan.history();
    expect(history.map((r) => r.value)).toEqual([!start, start, !start]);
    expect(history[0]!.value).toBe((await jordan.get('/me/settings')).body.familiesSee.email);
  });
});

describe('consent records: open to recruiting', () => {
  it('records turning it off and on', async () => {
    const { as } = await world();
    const jordan = await as('athlete');
    await jordan.put('/me/settings', { openToRecruiting: false });
    await jordan.put('/me/settings', { openToRecruiting: true });
    expect(choices(await jordan.history())).toEqual([
      [consentFlags.openToRecruiting, false],
      [consentFlags.openToRecruiting, true],
    ]);
  });

  it('records it going off when the athlete unpublishes their card', async () => {
    const { as } = await world();
    const jordan = await as('athlete');
    expect((await jordan.post('/cards/me/unpublish')).status).toBe(200);
    expect(choices(await jordan.history())).toEqual([[consentFlags.openToRecruiting, false]]);
  });
});

describe('consent records: findable through a community', () => {
  it('records the switch from settings and from the community page alike', async () => {
    const { as } = await world();
    const jordan = await as('athlete');
    await jordan.put('/me/settings', { searchable: [{ communityId: FIRST_GEN, on: false }] });
    await jordan.put(`/communities/${FIRST_GEN}/membership`, { recruiterSearchOptIn: true });
    expect(choices(await jordan.history())).toEqual([
      [consentFlags.findableIn(FIRST_GEN), false],
      [consentFlags.findableIn(FIRST_GEN), true],
    ]);
  });

  it('records the opt-in ending when the athlete leaves the community', async () => {
    const { as } = await world();
    const priya = await as('alumni_athlete');
    expect((await priya.post(`/communities/${FIRST_GEN}/leave`)).status).toBe(200);
    expect(choices(await priya.history())).toEqual([[consentFlags.findableIn(FIRST_GEN), false]]);
  });

  it('records the opt-in ending when staff merge the community away', async () => {
    const { as } = await world();
    const staff = await as('staff');
    const merged = await staff.post(`/staff/communities/${FIRST_GEN}/merge`, { intoId: FINANCE });
    expect(merged.status).toBe(200);
    const jordan = await as('athlete');
    expect(choices(await jordan.history())).toEqual([[consentFlags.findableIn(FIRST_GEN), false]]);
  });
});

describe('consent history', () => {
  it('shows each user only their own records', async () => {
    const { as } = await world();
    const jordan = await as('athlete');
    await jordan.put('/me/settings', { openToRecruiting: false });
    for (const role of ['parent', 'coach', 'recruiter', 'staff', 'teen'] as const) {
      expect(await (await as(role)).history(), role).toEqual([]);
    }
    expect((await jordan.history()).length).toBe(1);
  });
});
