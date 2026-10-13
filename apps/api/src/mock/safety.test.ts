import { afterEach, describe, expect, it } from 'vitest';
import type { Role } from '@team-impact/contracts';
import { buildApp } from '../app';
import { id, USERS } from './fixtures';

const TEAM_COMMUNITY = id(301);
const TEAM_IMPACT = id(302);
const MEDICAL = id(303);
const FIRST_GEN = id(304); // official interest
const FINANCE = id(305); // open interest
const CAPTAINS = id(307); // private interest
const COACH_POST = id(401);
const NOAH_POST = id(406);
const SOCCER = id(201);
const TUFTS = id(701);
const NORTHBEAM = id(801);
const FALL_INTERNS = id(901); // Elena's, shared with Tom
const MATEO = id(150); // Lisa's child

let closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(closers.map((c) => c()));
  closers = [];
});

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** One mock API shared by several signed-in clients, so writes by one are seen by the others. */
const world = async () => {
  const app = await buildApp({ sessionSecret: 'x'.repeat(32), corsOrigins: [], mock: true });
  closers.push(() => app.close());
  const as = async (role: Role) => {
    const res = await app.inject({ method: 'POST', url: '/auth/dev-sign-in', payload: { role } });
    expect(res.statusCode).toBe(200);
    const cookie = res.cookies[0]!;
    const call = async (method: Method, url: string, payload?: object) => {
      const r = await app.inject({
        method,
        url,
        ...(payload ? { payload } : {}),
        cookies: { [cookie.name]: cookie.value },
      });
      return { status: r.statusCode, body: r.body ? r.json() : undefined, text: r.body };
    };
    return { call, get: (url: string) => call('GET', url) };
  };
  return { as };
};

const postIds = (body: { items: { id: string }[] }) => body.items.map((p) => p.id);

describe('reports', () => {
  it('turns a report into a staff ticket and hides the item for the reporter', async () => {
    const w = await world();
    const athlete = await w.as('athlete');
    expect(postIds((await athlete.get('/feed')).body)).toContain(COACH_POST);

    const res = await athlete.call('POST', '/reports', {
      target: { kind: 'post', id: COACH_POST },
      reason: 'bullying',
      note: 'Not OK',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ reason: 'bullying', status: 'open' });
    expect(res.text).not.toContain(USERS.coach.id);

    const staff = await w.as('staff');
    const tickets = (await staff.get('/staff/moderation/tickets')).body;
    const ticket = tickets.find((t: { target: { id: string } }) => t.target.id === COACH_POST);
    expect(ticket).toMatchObject({ status: 'open', reportCount: 1, reasons: ['bullying'] });
    expect(ticket.preview).toContain('Practice moves');

    // Hidden for the reporter straight away; nobody else loses it until staff decide.
    expect(postIds((await athlete.get('/feed')).body)).not.toContain(COACH_POST);
    const parent = await w.as('parent');
    expect(postIds((await parent.get('/feed')).body)).toContain(COACH_POST);

    const mine = (await athlete.get('/me/reports')).body;
    expect(mine).toHaveLength(1);
  });

  it('refuses a duplicate report from the same person with 409, but collects others into one ticket', async () => {
    const w = await world();
    const athlete = await w.as('athlete');
    const report = { target: { kind: 'community', id: FINANCE }, reason: 'spam' };
    expect((await athlete.call('POST', '/reports', report)).status).toBe(201);
    const again = await athlete.call('POST', '/reports', report);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('conflict');

    const coach = await w.as('coach');
    expect((await coach.call('POST', '/reports', { ...report, reason: 'other' })).status).toBe(201);
    const staff = await w.as('staff');
    const tickets = (await staff.get('/staff/moderation/tickets')).body.filter(
      (t: { target: { id: string } }) => t.target.id === FINANCE,
    );
    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toMatchObject({ reportCount: 2, reasons: ['spam', 'other'] });
  });

  it('only reports what the reporter can see', async () => {
    const w = await world();
    const teen = await w.as('teen');
    // Teens never see medical communities, so they can't even confirm one exists.
    const medical = await teen.call('POST', '/reports', {
      target: { kind: 'community', id: MEDICAL },
      reason: 'spam',
    });
    expect(medical.status).toBe(404);
    const recruiter = await w.as('recruiter');
    const child = await recruiter.call('POST', '/reports', {
      target: { kind: 'profile', id: MATEO },
      reason: 'other',
    });
    expect(child.status).toBe(404);
    const parent = await w.as('parent');
    expect(
      (
        await parent.call('POST', '/reports', {
          target: { kind: 'profile', id: USERS.jordan.id },
          reason: 'impersonation',
        })
      ).status,
    ).toBe(201);
  });
});

describe('blocking', () => {
  it('removes a blocked person’s posts from the feed, both ways, and undoes cleanly', async () => {
    const w = await world();
    const athlete = await w.as('athlete');
    expect(postIds((await athlete.get('/feed')).body)).toContain(NOAH_POST);

    const block = await athlete.call('POST', `/blocks/${USERS.noah.id}`);
    expect(block.status).toBe(201);
    expect(block.body.user.id).toBe(USERS.noah.id);
    expect(postIds((await athlete.get('/feed')).body)).not.toContain(NOAH_POST);
    expect(postIds((await athlete.get(`/communities/${TEAM_COMMUNITY}/posts`)).body)).not.toContain(
      NOAH_POST,
    );
    expect((await athlete.get('/blocks')).body).toHaveLength(1);

    // The blocked person can't see the blocker's posts either.
    const coach = await w.as('coach');
    const teen = await w.as('teen');
    expect(postIds((await teen.get('/feed')).body)).toContain(COACH_POST);
    await coach.call('POST', `/blocks/${USERS.noah.id}`);
    expect(postIds((await teen.get('/feed')).body)).not.toContain(COACH_POST);

    expect((await athlete.call('DELETE', `/blocks/${USERS.noah.id}`)).status).toBe(204);
    expect(postIds((await athlete.get('/feed')).body)).toContain(NOAH_POST);
  });

  it('never blocks Team Impact’s official posts', async () => {
    const w = await world();
    const athlete = await w.as('athlete');
    expect((await athlete.call('POST', `/blocks/${USERS.staff.id}`)).status).toBe(400);
    expect((await athlete.call('POST', `/blocks/${USERS.jordan.id}`)).status).toBe(400);
  });
});

describe('account deletion', () => {
  it('deletes a parent with their children’s profiles and signs them out', async () => {
    const w = await world();
    const parent = await w.as('parent');
    const coach = await w.as('coach');
    // Lisa's post in the medical community is visible to its members before.
    const athlete = await w.as('athlete');
    expect(postIds((await athlete.get('/feed')).body)).toContain(id(404));

    const res = await parent.call('DELETE', '/me');
    expect(res.status).toBe(204);
    expect((await parent.get('/me')).status).toBe(401);
    expect(postIds((await athlete.get('/feed')).body)).not.toContain(id(404));

    // Mateo's profile went with Lisa: reporting it now finds nothing.
    const mateo = await coach.call('POST', '/reports', {
      target: { kind: 'profile', id: MATEO },
      reason: 'other',
    });
    expect(mateo.status).toBe(404);
    // Ella (Mark's child) is still there.
    const ella = await coach.call('POST', '/reports', {
      target: { kind: 'profile', id: id(151) },
      reason: 'other',
    });
    expect(ella.status).toBe(201);
    // The medical community Lisa created passes to its longest-standing member.
    const medical = (await athlete.get(`/communities/${MEDICAL}`)).body;
    expect(medical.createdBy.id).toBe(USERS.jordan.id);
  });

  it('won’t let staff, or a live team’s only coach, delete themselves', async () => {
    const w = await world();
    expect((await (await w.as('staff')).call('DELETE', '/me')).status).toBe(403);
    expect((await (await w.as('coach')).call('DELETE', '/me')).status).toBe(409);
  });
});

describe('staff tools', () => {
  it('refuses every staff route to everyone but staff', async () => {
    const w = await world();
    const routes: [Method, string, object?][] = [
      ['GET', '/staff/colleges'],
      ['POST', '/staff/colleges', { name: 'Brandeis University' }],
      ['PUT', `/staff/colleges/${TUFTS}`, { name: 'Tufts' }],
      ['POST', `/staff/colleges/${TUFTS}/merge`, { intoCollegeId: id(702) }],
      [
        'POST',
        '/staff/teams',
        {
          collegeId: TUFTS,
          sport: 'Hockey',
          gender: 'men',
          name: "Men's Hockey",
          division: 'III',
          firstCoachEmail: 'a@tufts.edu',
        },
      ],
      ['PATCH', `/staff/teams/${SOCCER}`, { name: 'Soccer' }],
      ['POST', `/staff/teams/${SOCCER}/archive`],
      ['GET', `/staff/teams/${SOCCER}/coaches`],
      ['POST', `/staff/teams/${SOCCER}/coach-invites`, { email: 'b@tufts.edu' }],
      ['POST', `/staff/coach-invites/${id(9999)}/revoke`],
      ['POST', '/staff/companies', { name: 'Acme', domains: ['acme.com'] }],
      ['POST', `/staff/companies/${NORTHBEAM}/suspend`],
      ['POST', `/staff/companies/${NORTHBEAM}/restore`],
      ['POST', `/staff/communities/${FINANCE}/merge`, { intoId: FIRST_GEN }],
      ['DELETE', `/staff/communities/${FINANCE}`],
      ['GET', '/staff/announcements'],
      [
        'POST',
        '/staff/announcements',
        { communityId: TEAM_IMPACT, text: 'Hello everyone!', sendPush: false },
      ],
    ];
    for (const role of [
      'coach',
      'athlete',
      'parent',
      'teen',
      'recruiter',
      'alumni_athlete',
    ] as const) {
      const client = await w.as(role);
      for (const [method, url, body] of routes) {
        const res = await client.call(method, url, body);
        expect(res.status, `${role} ${method} ${url}`).toBe(403);
      }
    }
  });

  it('creates a team with its community and first coach invite, and blocks duplicates', async () => {
    const w = await world();
    const staff = await w.as('staff');
    const body = {
      collegeId: TUFTS,
      sport: 'Hockey',
      gender: 'men',
      name: "Men's Hockey",
      division: 'III',
      firstCoachEmail: 'Coach@Tufts.edu',
    };
    const team = await staff.call('POST', '/staff/teams', body);
    expect(team.status).toBe(201);
    expect(team.body.status).toBe('invited');
    const coaches = (await staff.get(`/staff/teams/${team.body.id}/coaches`)).body;
    expect(coaches.invites[0].email).toBe('coach@tufts.edu');
    expect((await staff.call('POST', '/staff/teams', { ...body, sport: 'hockey' })).status).toBe(
      409,
    );
    const archived = await staff.call('POST', `/staff/teams/${team.body.id}/archive`);
    expect(archived.body.status).toBe('archived');
    // Archived teams leave the join search.
    const athlete = await w.as('athlete');
    const found = (await athlete.get(`/teams?collegeId=${TUFTS}`)).body;
    expect(found.map((t: { id: string }) => t.id)).not.toContain(team.body.id);
  });

  it('suspends a company: its recruiters get 403 until it is restored', async () => {
    const w = await world();
    const recruiter = await w.as('recruiter');
    expect((await recruiter.get('/lists')).status).toBe(200);
    const staff = await w.as('staff');
    const res = await staff.call('POST', `/staff/companies/${NORTHBEAM}/suspend`);
    expect(res.body.status).toBe('suspended');
    for (const url of ['/lists', '/search/athletes', '/me']) {
      expect((await recruiter.get(url)).status, url).toBe(403);
    }
    await staff.call('POST', `/staff/companies/${NORTHBEAM}/restore`);
    expect((await recruiter.get('/lists')).status).toBe(200);
  });

  it('merges communities of the same kind only, never team ones', async () => {
    const w = await world();
    const staff = await w.as('staff');
    const acrossKinds = await staff.call('POST', `/staff/communities/${FINANCE}/merge`, {
      intoId: MEDICAL,
    });
    expect(acrossKinds.status).toBe(400);
    const team = await staff.call('POST', `/staff/communities/${TEAM_COMMUNITY}/merge`, {
      intoId: TEAM_IMPACT,
    });
    expect(team.status).toBe(400);
    const privateIntoOpen = await staff.call('POST', `/staff/communities/${CAPTAINS}/merge`, {
      intoId: FINANCE,
    });
    expect(privateIntoOpen.status).toBe(400);

    const merged = await staff.call('POST', `/staff/communities/${FINANCE}/merge`, {
      intoId: FIRST_GEN,
    });
    expect(merged.status).toBe(200);
    // Riley joins First-gen through the merge but is not made findable by recruiters.
    expect(merged.body.recruiterSearchOptInCount).toBe(2);
    expect((await staff.get(`/communities/${FINANCE}`)).status).toBe(404);
  });

  it('posts staff announcements straight into the Team Impact feed', async () => {
    const w = await world();
    const staff = await w.as('staff');
    const res = await staff.call('POST', '/staff/announcements', {
      communityId: TEAM_IMPACT,
      text: 'Pilot opens in December!',
      sendPush: true,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      kind: 'announcement',
      official: true,
      moderation: 'approved',
    });
    const parent = await w.as('parent');
    expect(postIds((await parent.get('/feed')).body)).toContain(res.body.id);
    const medical = await staff.call('POST', '/staff/announcements', {
      communityId: MEDICAL,
      text: 'Not allowed here.',
      sendPush: false,
    });
    expect(medical.status).toBe(400);
  });
});

describe('recruiter lists', () => {
  it('creates, renames, shares, notes and deletes a list', async () => {
    const w = await world();
    const elena = await w.as('recruiter');
    const created = await elena.call('POST', '/lists', { name: 'Spring', color: '#1E3F7B' });
    expect(created.status).toBe(201);
    const listId = created.body.id;
    expect((await elena.call('POST', '/lists', { name: 'spring', color: '#1E3F7B' })).status).toBe(
      409,
    );
    expect((await elena.call('PATCH', `/lists/${listId}`, { name: 'Spring 2027' })).body.name).toBe(
      'Spring 2027',
    );
    const shared = await elena.call('POST', `/lists/${listId}/share`, { userId: USERS.tom.id });
    expect(shared.body.sharedWith.map((u: { id: string }) => u.id)).toEqual([USERS.tom.id]);
    // Never outside the company.
    expect(
      (await elena.call('POST', `/lists/${listId}/share`, { userId: USERS.jordan.id })).status,
    ).toBe(400);

    const added = await elena.call('POST', `/lists/${listId}/athletes/${USERS.jordan.id}`);
    expect(added.status).toBe(200);
    expect(added.body.entries).toHaveLength(1);
    const note = await elena.call('PUT', `/lists/${listId}/athletes/${USERS.jordan.id}/note`, {
      text: 'Call after finals',
    });
    expect(note.body.text).toBe('Call after finals');
    expect((await elena.get(`/lists/${listId}`)).body.entries[0].latestNote.text).toBe(
      'Call after finals',
    );
    const removed = await elena.call('DELETE', `/lists/${listId}/athletes/${USERS.jordan.id}`);
    expect(removed.body.entries).toHaveLength(0);
    expect((await elena.call('DELETE', `/lists/${listId}`)).status).toBe(204);
    expect((await elena.get(`/lists/${listId}`)).status).toBe(404);
  });

  it('never puts a child, teen or athlete who isn’t open to recruiting on a list', async () => {
    const w = await world();
    const elena = await w.as('recruiter');
    for (const athleteId of [MATEO, USERS.noah.id, USERS.riley.id, USERS.ava.id]) {
      const res = await elena.call('POST', `/lists/${FALL_INTERNS}/athletes/${athleteId}`);
      expect(res.status, athleteId).toBe(404);
      expect(res.text).not.toContain('Mateo');
    }
  });

  it('keeps other recruiters’ unshared lists out of reach', async () => {
    const w = await world();
    const elena = await w.as('recruiter');
    // Tom's own list was never shared with Elena.
    expect((await elena.get(`/lists/${id(902)}`)).status).toBe(404);
    expect((await elena.call('DELETE', `/lists/${id(902)}`)).status).toBe(404);
    expect((await elena.call('POST', `/lists/${id(902)}/athletes/${USERS.jordan.id}`)).status).toBe(
      404,
    );
  });
});
