// Contact and visibility settings: every privacy choice is kept as a timestamped consent record
// (PRD §6, §7), read back through GET /me/consent-history.
import { afterEach, describe, expect, it } from 'vitest';
import {
  type ConsentRecord,
  consentFlags,
  type MySettings,
  type Role,
} from '@team-impact/contracts';
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
      settings: async () => (await call('GET', '/me/settings')).body as MySettings,
    };
  };
  return { as };
};

/** Just flag and value, oldest first, for readable assertions. */
const choices = (records: ConsentRecord[]) =>
  [...records].reverse().map(({ flag, value }) => [flag, value]);

/**
 * Starts watching someone's history: the returned function gives only the records added since,
 * oldest first. The fixtures' own opt-ins are already recorded, so tests compare what changed.
 */
const watch = async (who: { history: () => Promise<ConsentRecord[]> }) => {
  const start = (await who.history()).length;
  return async () => {
    const all = await who.history();
    return choices(all.slice(0, all.length - start));
  };
};

/** Every flag's current value per the history: its newest record, or off if it has none. */
const fromHistory = (records: ConsentRecord[]) => {
  const current = new Map<string, boolean>();
  for (const r of [...records].reverse()) current.set(r.flag, r.value);
  return (flag: string) => current.get(flag) ?? false;
};

/** Every consent flag the settings screen shows, with its value there. */
const flagsIn = (s: MySettings): [string, boolean][] => [
  ...(['email', 'phone', 'linkedin'] as const).flatMap((ch): [string, boolean][] => [
    [consentFlags.familiesSee(ch), s.familiesSee?.[ch] ?? false],
    [consentFlags.recruitersSee(ch), s.recruitersSee?.[ch] ?? false],
  ]),
  [consentFlags.openToRecruiting, s.openToRecruiting.on],
  ...s.searchable.map((x): [string, boolean] => [consentFlags.findableIn(x.community.id), x.on]),
];

describe('consent flag names', () => {
  it('use the contact_visibility table’s scopes and channels', () => {
    expect(consentFlags.familiesSee('phone')).toBe('family_sees:phone');
    expect(consentFlags.recruitersSee('linkedin')).toBe('recruiter_sees:linkedin');
  });
});

describe('consent records: where everyone starts', () => {
  it('the fixtures’ opt-ins are already recorded, so the newest record is always the current value', async () => {
    const { as } = await world();
    for (const role of ['athlete', 'alumni_athlete'] as const) {
      const who = await as(role);
      const current = fromHistory(await who.history());
      for (const [flag, on] of flagsIn(await who.settings())) expect(current(flag), flag).toBe(on);
    }
    const jordan = await as('athlete');
    expect(choices(await jordan.history())).toEqual(
      expect.arrayContaining([
        [consentFlags.openToRecruiting, true],
        [consentFlags.findableIn(FIRST_GEN), true],
        [consentFlags.familiesSee('email'), true],
      ]),
    );
    const priya = await as('alumni_athlete');
    expect(choices(await priya.history())).toContainEqual([
      consentFlags.findableIn(FIRST_GEN),
      true,
    ]);
  });

  it('publishing a first card records the email it shares by default', async () => {
    const { as } = await world();
    const leo = await as('athlete', true);
    expect(await leo.history()).toEqual([]);
    expect(
      (await leo.put('/cards/me', { position: 'Midfielder', classYear: 2028, major: 'History' }))
        .status,
    ).toBe(200);
    expect((await leo.post('/cards/me/publish')).status).toBe(200);
    // Turning recruiting on now shows recruiters their email: the history says they agreed to that.
    await leo.put('/me/settings', { openToRecruiting: true });

    const history = await leo.history();
    expect(choices(history)).toEqual([
      [consentFlags.familiesSee('email'), true],
      [consentFlags.recruitersSee('email'), true],
      [consentFlags.openToRecruiting, true],
    ]);
    const current = fromHistory(history);
    for (const [flag, on] of flagsIn(await leo.settings())) expect(current(flag), flag).toBe(on);
  });
});

describe('consent records: contact sharing', () => {
  it('records each changed channel for families and recruiters, with a timestamp', async () => {
    const { as } = await world();
    const jordan = await as('athlete');
    const added = await watch(jordan);

    const before = (await jordan.get('/me/settings')).body;
    const res = await jordan.put('/me/settings', {
      familiesSee: { phone: !before.familiesSee.phone },
      recruitersSee: {
        email: !before.recruitersSee.email,
        linkedin: !before.recruitersSee.linkedin,
      },
    });
    expect(res.status).toBe(200);

    expect(await added()).toEqual([
      [consentFlags.familiesSee('phone'), !before.familiesSee.phone],
      [consentFlags.recruitersSee('email'), !before.recruitersSee.email],
      [consentFlags.recruitersSee('linkedin'), !before.recruitersSee.linkedin],
    ]);
    for (const r of await jordan.history()) {
      expect(new Date(r.recordedAt).toISOString()).toBe(r.recordedAt);
    }
  });

  it('records nothing when a value is sent unchanged, or only contact details change', async () => {
    const { as } = await world();
    const jordan = await as('athlete');
    const added = await watch(jordan);
    const before = (await jordan.get('/me/settings')).body;
    await jordan.put('/me/settings', {
      familiesSee: before.familiesSee,
      recruitersSee: before.recruitersSee,
      openToRecruiting: before.openToRecruiting.on,
      contact: { phone: '(617) 555-0100' },
    });
    expect(await added()).toEqual([]);
  });

  it('records nothing for a refused change', async () => {
    const { as } = await world();
    const leo = await as('athlete', true); // no published card yet
    expect((await leo.put('/me/settings', { openToRecruiting: true })).status).toBe(400);
    expect(await leo.history()).toEqual([]);
  });

  it('records nothing when any opt-in in a batch is refused, even ones that would pass', async () => {
    const { as } = await world();
    const jordan = await as('athlete');
    const added = await watch(jordan);
    const findable = async () =>
      (await jordan.settings()).searchable.find((x) => x.community.id === FIRST_GEN)?.on;
    expect(await findable()).toBe(true);

    for (const [refused, status] of [
      [{ communityId: id(9999), on: true }, 404], // no such community
      [{ communityId: FINANCE, on: true }, 400], // not official
    ] as const) {
      const res = await jordan.put('/me/settings', {
        searchable: [{ communityId: FIRST_GEN, on: false }, refused],
      });
      expect(res.status).toBe(status);
    }
    expect(await findable()).toBe(true); // the valid half wasn't applied
    expect(await added()).toEqual([]);
  });

  it('keeps the whole history, newest first: the latest record is the current value', async () => {
    const { as } = await world();
    const jordan = await as('athlete');
    const start = (await jordan.get('/me/settings')).body.familiesSee.email as boolean;
    const added = await watch(jordan);
    for (const on of [!start, start, !start]) {
      await jordan.put('/me/settings', { familiesSee: { email: on } });
    }
    expect((await added()).map(([, value]) => value)).toEqual([!start, start, !start]);
    const history = await jordan.history();
    expect(history[0]!.value).toBe((await jordan.get('/me/settings')).body.familiesSee.email);
  });
});

describe('consent records: open to recruiting', () => {
  it('records turning it off and on', async () => {
    const { as } = await world();
    const jordan = await as('athlete');
    const added = await watch(jordan);
    await jordan.put('/me/settings', { openToRecruiting: false });
    await jordan.put('/me/settings', { openToRecruiting: true });
    expect(await added()).toEqual([
      [consentFlags.openToRecruiting, false],
      [consentFlags.openToRecruiting, true],
    ]);
  });

  it('records it going off when the athlete unpublishes their card', async () => {
    const { as } = await world();
    const jordan = await as('athlete');
    const added = await watch(jordan);
    expect((await jordan.post('/cards/me/unpublish')).status).toBe(200);
    expect(await added()).toEqual([[consentFlags.openToRecruiting, false]]);
  });
});

describe('consent records: findable through a community', () => {
  it('records the switch from settings and from the community page alike', async () => {
    const { as } = await world();
    const jordan = await as('athlete');
    const added = await watch(jordan);
    await jordan.put('/me/settings', { searchable: [{ communityId: FIRST_GEN, on: false }] });
    await jordan.put(`/communities/${FIRST_GEN}/membership`, { recruiterSearchOptIn: true });
    expect(await added()).toEqual([
      [consentFlags.findableIn(FIRST_GEN), false],
      [consentFlags.findableIn(FIRST_GEN), true],
    ]);
  });

  it('records the opt-in ending when the athlete leaves the community', async () => {
    const { as } = await world();
    const priya = await as('alumni_athlete');
    const added = await watch(priya);
    expect((await priya.post(`/communities/${FIRST_GEN}/leave`)).status).toBe(200);
    expect(await added()).toEqual([[consentFlags.findableIn(FIRST_GEN), false]]);
  });

  it('records the opt-in ending when staff merge the community away', async () => {
    const { as } = await world();
    const jordan = await as('athlete');
    const added = await watch(jordan);
    const staff = await as('staff');
    const merged = await staff.post(`/staff/communities/${FIRST_GEN}/merge`, { intoId: FINANCE });
    expect(merged.status).toBe(200);
    expect(await added()).toEqual([[consentFlags.findableIn(FIRST_GEN), false]]);
  });
});

describe('consent history', () => {
  it('shows each user only their own records', async () => {
    const { as } = await world();
    const jordan = await as('athlete');
    const added = await watch(jordan);
    await jordan.put('/me/settings', { openToRecruiting: false });
    for (const role of ['parent', 'coach', 'recruiter', 'staff', 'teen'] as const) {
      expect(await (await as(role)).history(), role).toEqual([]);
    }
    expect(await added()).toHaveLength(1);
  });
});
