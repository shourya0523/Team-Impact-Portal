// Roster and plain profiles (PRD §2): every non-athlete has a plain profile (name, photo, role, team
// or company) that its owner edits; a recruiter's profile sits under their company.
import { afterEach, describe, expect, it } from 'vitest';
import type { Role } from '@team-impact/contracts';
import { buildApp } from '../app';
import { id, USERS } from './fixtures';

const TEAM = id(201);
const NORTHBEAM = id(801); // Elena's company

let close: (() => Promise<void>) | undefined;
afterEach(() => close?.());

/** One mock API; `as(role)` signs a fixture user in, so several people act on the same world. */
const world = async () => {
  const app = await buildApp({ sessionSecret: 'x'.repeat(32), corsOrigins: [], mock: true });
  close = () => app.close();
  const anonymous = (method: 'GET' | 'PATCH', url: string, payload?: object) =>
    app.inject({ method, url, ...(payload ? { payload } : {}) });
  const as = async (role: Role) => {
    const res = await app.inject({ method: 'POST', url: '/auth/dev-sign-in', payload: { role } });
    expect(res.statusCode).toBe(200);
    const cookie = res.cookies[0]!;
    const call = async (
      method: 'GET' | 'PATCH' | 'PUT' | 'POST',
      url: string,
      payload?: object,
    ) => {
      const r = await app.inject({
        method,
        url,
        ...(payload ? { payload } : {}),
        cookies: { [cookie.name]: cookie.value },
      });
      return { status: r.statusCode, body: r.json() };
    };
    return {
      get: (url: string) => call('GET', url),
      patch: (url: string, payload: object) => call('PATCH', url, payload),
      put: (url: string, payload: object) => call('PUT', url, payload),
      post: (url: string) => call('POST', url),
    };
  };
  return { as, anonymous };
};

describe('plain profiles: the owner edits theirs', () => {
  it('changes the name everywhere others see it', async () => {
    const { as } = await world();
    const lisa = await as('parent');
    const res = await lisa.patch('/me', { firstName: 'Elisa', lastName: 'Moreno' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ firstName: 'Elisa', lastName: 'Moreno' });
    expect((await lisa.get('/me')).body.firstName).toBe('Elisa');

    const coach = await as('coach');
    expect((await coach.get(`/profiles/${USERS.lisa.id}`)).body.user.firstName).toBe('Elisa');
    const roster = (await coach.get(`/teams/${TEAM}/members`)).body;
    const onRoster = roster.parents.find(
      (p: { user: { id: string } }) => p.user.id === USERS.lisa.id,
    );
    expect(onRoster.user).toMatchObject({ firstName: 'Elisa', lastName: 'Moreno' });
  });

  it('renames the athlete’s Baseball Card too, and a pending draft, but not past seasons', async () => {
    const { as } = await world();
    const jordan = await as('athlete');
    const cardId = (await jordan.get('/cards/me')).body.card.id;
    // An unpublished draft that still carries the old name must not bring it back on publish.
    await jordan.put('/cards/me', { firstName: USERS.jordan.firstName, major: 'Finance' });
    expect((await jordan.patch('/me', { firstName: 'Jordy' })).status).toBe(200);

    const mine = (await jordan.get('/cards/me')).body;
    expect(mine.card).toMatchObject({ firstName: 'Jordy', lastName: USERS.jordan.lastName });
    expect(mine.draft).toMatchObject({ firstName: 'Jordy', major: 'Finance' });
    // Others see the new name on the card face; the earlier published versions keep theirs.
    const staff = await as('staff');
    expect((await staff.get(`/cards/${USERS.jordan.id}`)).body.firstName).toBe('Jordy');
    expect((await staff.get(`/profiles/${USERS.jordan.id}`)).body.card.firstName).toBe('Jordy');
    expect((await jordan.post('/cards/me/publish')).status).toBe(200);
    const history = (await jordan.get('/cards/me/history')).body;
    expect(history[0].face).toMatchObject({ id: cardId, firstName: 'Jordy', major: 'Finance' });
    expect(history.at(-1).face.firstName).toBe(USERS.jordan.firstName);
  });

  it('changes only what was sent', async () => {
    const { as } = await world();
    const coach = await as('coach');
    const before = (await coach.get('/me')).body;
    const res = await coach.patch('/me', { lastName: 'Rivers' });
    expect(res.body).toMatchObject({ firstName: before.firstName, lastName: 'Rivers' });
  });

  it('refuses an empty or overlong name', async () => {
    const { as } = await world();
    const lisa = await as('parent');
    for (const body of [{ firstName: '' }, { lastName: '   ' }, { firstName: 'x'.repeat(81) }]) {
      expect((await lisa.patch('/me', body)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await lisa.get('/me')).body.firstName).toBe(USERS.lisa.firstName);
  });

  it('can’t change role, team or company', async () => {
    const { as } = await world();
    const lisa = await as('parent');
    await lisa.patch('/me', { role: 'staff', teamIds: [], companyId: NORTHBEAM });
    const me = (await lisa.get('/me')).body;
    expect(me.role).toBe('parent');
    expect(me.teamIds).toEqual([TEAM]);
  });

  it('needs a session', async () => {
    const { anonymous } = await world();
    expect((await anonymous('PATCH', '/me', { firstName: 'X' })).statusCode).toBe(401);
  });
});

describe('plain profiles: recruiters sit under their company', () => {
  it('shows the company on a recruiter’s profile to those who may see it', async () => {
    const { as } = await world();
    for (const role of ['recruiter', 'staff'] as const) {
      const res = await (await as(role)).get(`/profiles/${USERS.elena.id}`);
      expect(res.status, role).toBe(200);
      expect(res.body.company, role).toEqual({ id: NORTHBEAM, name: expect.any(String) });
    }
    // Families, athletes and teens never see recruiters' profiles at all (PRD §2).
    for (const role of ['parent', 'athlete', 'teen'] as const) {
      expect((await (await as(role)).get(`/profiles/${USERS.elena.id}`)).status, role).toBe(404);
    }
  });

  it('shows no company on anyone else’s profile, and never the company’s domains', async () => {
    const { as } = await world();
    const staff = await as('staff');
    for (const person of [USERS.jordan, USERS.lisa, USERS.coach]) {
      expect((await staff.get(`/profiles/${person.id}`)).body.company, person.firstName).toBeNull();
    }
    const elena = (await staff.get(`/profiles/${USERS.elena.id}`)).body;
    expect(Object.keys(elena.company).sort()).toEqual(['id', 'name']);
  });
});

describe('plain profiles: only athletes and alumni athletes show a Baseball Card', () => {
  it('every other profile is plain, even to staff, who may see every card', async () => {
    const { as } = await world();
    const staff = await as('staff');
    for (const [who, hasCard] of [
      [USERS.jordan, true], // athlete
      [USERS.priya, true], // alumni athlete
      [USERS.coach, false],
      [USERS.lisa, false], // parent
      [USERS.elena, false], // recruiter
      [USERS.chris, false], // alumni mentor
      [USERS.staff, false],
    ] as const) {
      const res = await staff.get(`/profiles/${who.id}`);
      expect(res.status, who.firstName).toBe(200);
      expect(res.body.kind, who.firstName).toBe('person');
      expect(res.body.card != null, who.firstName).toBe(hasCard);
    }
    // A teen's profile is plain by its very shape: it has no card at all. (Only the teen's team
    // opens it, so their coach looks.)
    const noah = await (await as('coach')).get(`/profiles/${USERS.noah.id}`);
    expect(noah.body.kind).toBe('teen');
    expect(noah.body).not.toHaveProperty('card');
  });
});
