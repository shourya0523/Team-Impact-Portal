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
    const call = async (method: 'GET' | 'PATCH', url: string, payload?: object) => {
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
