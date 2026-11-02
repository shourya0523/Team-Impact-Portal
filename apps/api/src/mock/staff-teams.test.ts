import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import {
  JoinRequest,
  TRACKED_EVENTS,
  type Role,
  type TrackedEventName,
} from '@team-impact/contracts';
import { colors, resolveTeamColor } from '@team-impact/ui-tokens';
import { useZodContracts } from '../zod';
import { id, USERS } from './fixtures';
import { registerMockRoutes } from './routes';
import { suspend } from './staff-tools';
import { INVITE_TOKENS, QR_TOKENS } from './team';
import { MockWorld } from './world';

const TUFTS = id(701);
const NORTHEASTERN = id(702); // no team yet
const SOCCER = id(201); // Tufts women's soccer: live, Dana is its only coach
const LACROSSE = id(202); // Tufts men's lacrosse: invited, waiting on its first coach
const BASKETBALL = id(210); // Tufts women's basketball: live
const SOCCER_COMMUNITY = id(301);
const KAI_REQUEST = id(1101); // pending on soccer
const LACROSSE_INVITE = id(1401); // sent by staff, pending
const REVOKED_INVITE = id(1402); // soccer assistant, revoked
const EXPIRED_INVITE = id(1403); // soccer assistant, expired
const COACH_POST = id(401); // Dana's post
const DAY = 86_400_000;
const MINUTE = 60_000;

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

let closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(closers.map((c) => c()));
  closers = [];
});

/** The mock API on a world the test can read. Each client keeps its own session cookie. */
const setup = async () => {
  const world = new MockWorld({ identitySearch: true, medicalCommunities: true });
  const app = useZodContracts(Fastify());
  await app.register(cookie, { secret: 'x'.repeat(32) });
  registerMockRoutes(app, world);
  closers.push(() => app.close());

  const client = () => {
    const jar: Record<string, string> = {};
    const call = async (method: Method, url: string, payload?: object) => {
      const r = await app.inject({ method, url, ...(payload ? { payload } : {}), cookies: jar });
      for (const c of r.cookies) jar[c.name] = c.value;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: any = r.body ? r.json() : undefined;
      return { status: r.statusCode, body, text: r.body };
    };
    return {
      get: (url: string) => call('GET', url),
      post: (url: string, payload?: object) => call('POST', url, payload),
      put: (url: string, payload: object) => call('PUT', url, payload),
      patch: (url: string, payload: object) => call('PATCH', url, payload),
      del: (url: string) => call('DELETE', url),
    };
  };
  const as = async (role: Role, newcomer = false) => {
    const c = client();
    expect((await c.post('/auth/dev-sign-in', { role, newcomer })).status).toBe(200);
    return c;
  };
  /** An invite's link: only ever emailed, never returned by the API. */
  const tokenOf = (inviteId: string) => world.coachInvites.find((i) => i.id === inviteId)!.token;
  /** Opens an invite link signed out and creates the coach's account; they stay signed in. */
  const acceptAsNewCoach = async (token: string, firstName = 'Alex', lastName = 'Moore') => {
    const c = client();
    const res = await c.post(`/invites/${token}/accept`, {
      newAccount: { firstName, lastName, password: 'correct horse battery', acceptTerms: true },
    });
    return { ...c, res, id: res.body?.id as string };
  };
  const logged = (name: TrackedEventName) => world.eventsLog.filter((e) => e.event === name);
  return { world, client, as, tokenOf, acceptAsNewCoach, logged };
};

type World = Awaited<ReturnType<typeof setup>>;
type Client = Awaited<ReturnType<World['as']>>;
type TeamOut = {
  id: string;
  name: string;
  status: string;
  color: string | null;
  sport: string;
  gender: string;
  division: string;
  college: { id: string; name: string };
};
type InviteOut = {
  id: string;
  teamId: string;
  email: string;
  invitedBy: { id: string };
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
};

/** Staff's men's ice hockey team at Tufts: a sport on the list, no colour picked. */
const hockey = {
  collegeId: TUFTS,
  sport: 'Ice Hockey',
  gender: 'men',
  name: "Men's Ice Hockey",
  division: 'III',
  firstCoachEmail: 'Pat.Lee@Tufts.edu',
};

const staffTeams = async (staff: Client) => (await staff.get('/staff/teams')).body as TeamOut[];
const staffTeam = async (staff: Client, teamId: string) =>
  (await staffTeams(staff)).find((t) => t.id === teamId);
const invitesOf = async (staff: Client, teamId: string) =>
  (await staff.get(`/staff/teams/${teamId}/coaches`)).body.invites as InviteOut[];
const coachIdsOf = async (staff: Client, teamId: string) =>
  ((await staff.get(`/staff/teams/${teamId}/coaches`)).body.coaches as { user: { id: string } }[])
    .map((c) => c.user.id)
    .sort();

/** Team ids the join search shows for a college (and sport). */
const joinSearch = async (c: Client, collegeId = TUFTS, sport?: string) => {
  const res = await c.get(
    `/teams?collegeId=${collegeId}${sport ? `&sport=${encodeURIComponent(sport)}` : ''}`,
  );
  expect(res.status).toBe(200);
  return (res.body as { id: string }[]).map((t) => t.id);
};

/** Event properties are ids, enums, counts and flags: never an email, a name or typed text. */
const expectNoPersonalData = (world: MockWorld, words: string[]) => {
  expect(world.eventsLog.length).toBeGreaterThan(0);
  for (const row of world.eventsLog) {
    const text = JSON.stringify(row.properties);
    expect(text, row.event).not.toContain('@');
    for (const w of words) {
      expect(text.toLowerCase(), `${row.event} mentions ${w}`).not.toContain(w.toLowerCase());
    }
    expect(TRACKED_EVENTS[row.event].properties.safeParse(row.properties).success, row.event).toBe(
      true,
    );
  }
};

/** Dana invites an assistant coach to soccer, who accepts with a new account. */
const addAssistant = async (w: World) => {
  const dana = await w.as('coach');
  const sent = await dana.post(`/teams/${SOCCER}/coach-invites`, {
    email: 'assistant.coach@tufts.edu',
  });
  expect(sent.status).toBe(201);
  const assistant = await w.acceptAsNewCoach(w.tokenOf(sent.body.id), 'Robin', 'Assistant');
  expect(assistant.res.status).toBe(200);
  return { dana, assistant };
};

/** Staff resolve a report on Dana's post by suspending her, the way staff suspend a coach. */
const suspendDana = async (w: World, staff: Client) => {
  const athlete = await w.as('athlete');
  await athlete.post('/reports', { target: { kind: 'post', id: COACH_POST }, reason: 'other' });
  const tickets = (await staff.get('/staff/moderation/tickets')).body as {
    id: string;
    status: string;
    target: { id: string };
  }[];
  const ticket = tickets.find((t) => t.target.id === COACH_POST && t.status === 'open')!;
  return staff.post(`/staff/moderation/tickets/${ticket.id}/resolve`, {
    resolution: 'dismiss',
    authorAction: 'suspend',
  });
};

// Colleges (S6) ------------------------------------------------------------------------------------

describe('colleges', () => {
  it('lists Tufts from the start, adds colleges and keeps one name per college', async () => {
    const { as } = await setup();
    const staff = await as('staff');
    const list = (await staff.get('/staff/colleges')).body as { id: string; name: string }[];
    expect(list).toContainEqual({ id: TUFTS, name: 'Tufts University' });

    const added = await staff.post('/staff/colleges', { name: '  Brandeis University ' });
    expect(added.status).toBe(201);
    expect(added.body.name).toBe('Brandeis University');
    expect((await staff.post('/staff/colleges', { name: 'brandeis university' })).status).toBe(409);
    const athlete = await as('athlete', true);
    const picker = ((await athlete.get('/colleges')).body as { name: string }[]).map((c) => c.name);
    expect(picker.filter((n) => n.toLowerCase() === 'brandeis university')).toEqual([
      'Brandeis University',
    ]);
  });

  it('renames a college wherever its teams show it, but never onto another college’s name', async () => {
    const { as } = await setup();
    const staff = await as('staff');
    const renamed = await staff.put(`/staff/colleges/${TUFTS}`, { name: 'Tufts (Medford)' });
    expect(renamed.status).toBe(200);
    expect((await staffTeam(staff, SOCCER))?.college).toEqual({
      id: TUFTS,
      name: 'Tufts (Medford)',
    });
    const athlete = await as('athlete', true);
    const picker = ((await athlete.get('/colleges')).body as { name: string }[]).map((c) => c.name);
    expect(picker).toContain('Tufts (Medford)');
    expect(picker).not.toContain('Tufts University');

    const clash = await staff.put(`/staff/colleges/${NORTHEASTERN}`, { name: 'tufts (medford)' });
    expect(clash.status).toBe(409);
  });

  it('only lets a team use a college from the list', async () => {
    const { as, world } = await setup();
    const staff = await as('staff');
    const before = (await staffTeams(staff)).length;
    const unknown = id(799);
    const created = await staff.post('/staff/teams', { ...hockey, collegeId: unknown });
    expect(created.status).toBe(404);
    expect(await staffTeams(staff)).toHaveLength(before);

    const moved = await staff.patch(`/staff/teams/${SOCCER}`, { collegeId: unknown });
    expect(moved.status).toBe(404);
    expect((await staffTeam(staff, SOCCER))?.college.id).toBe(TUFTS);
    expect(world.eventsLog).toEqual([]);
  });

  it('merging moves the duplicate’s teams to the survivor and drops it from the join search', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    const dup = (await staff.post('/staff/colleges', { name: 'Tufts Univ.' })).body;
    const team = (await staff.post('/staff/teams', { ...hockey, collegeId: dup.id })).body;
    const [invite] = await invitesOf(staff, team.id);
    expect((await w.acceptAsNewCoach(w.tokenOf(invite!.id), 'Pat', 'Lee')).res.status).toBe(200);
    const athlete = await w.as('athlete', true);
    expect(await joinSearch(athlete, dup.id)).toEqual([team.id]);

    const merged = await staff.post(`/staff/colleges/${dup.id}/merge`, { intoCollegeId: TUFTS });
    expect(merged.status).toBe(200);
    expect(merged.body.id).toBe(TUFTS);

    // The duplicate is gone from the college picker; its team is found under Tufts.
    const picker = ((await athlete.get('/colleges')).body as { id: string }[]).map((c) => c.id);
    expect(picker).not.toContain(dup.id);
    expect(picker).toContain(TUFTS);
    expect(await joinSearch(athlete, TUFTS)).toContain(team.id);
    const underDup = await athlete.get(`/teams?collegeId=${dup.id}`);
    expect(underDup.status).toBe(200);
    expect(underDup.body).toEqual([]);
    expect((await staffTeam(staff, team.id))?.college).toEqual({
      id: TUFTS,
      name: 'Tufts University',
    });
    const staffList = ((await staff.get('/staff/colleges')).body as { id: string }[]).map(
      (c) => c.id,
    );
    expect(staffList).not.toContain(dup.id);
    // And it can't be picked for a new team any more.
    const late = await staff.post('/staff/teams', {
      ...hockey,
      collegeId: dup.id,
      sport: 'Rowing',
    });
    expect(late.status).toBe(404);
  });

  it('won’t merge two colleges that each have the same team', async () => {
    const { as } = await setup();
    const staff = await as('staff');
    const dup = (await staff.post('/staff/colleges', { name: 'Tufts Univ.' })).body;
    const soccer = await staff.post('/staff/teams', {
      ...hockey,
      collegeId: dup.id,
      sport: 'Soccer',
      gender: 'women',
      name: "Women's Soccer",
    });
    expect(soccer.status).toBe(201);
    const merged = await staff.post(`/staff/colleges/${dup.id}/merge`, { intoCollegeId: TUFTS });
    expect(merged.status).toBe(409);
    expect((await staffTeam(staff, soccer.body.id))?.college.id).toBe(dup.id);
    const list = ((await staff.get('/staff/colleges')).body as { id: string }[]).map((c) => c.id);
    expect(list).toContain(dup.id);
  });
});

// Creating a team (S2) -----------------------------------------------------------------------------

describe('creating a team', () => {
  it('creates a team for a listed sport, with its community, in navy, waiting on its first coach', async () => {
    const { as, logged } = await setup();
    const staff = await as('staff');
    const res = await staff.post('/staff/teams', hockey);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      college: { id: TUFTS, name: 'Tufts University' },
      sport: 'Ice Hockey',
      gender: 'men',
      name: "Men's Ice Hockey",
      division: 'III',
      status: 'invited',
    });
    // No colour picked: the team shows Team Impact navy.
    expect(resolveTeamColor(res.body.color)).toBe(colors.brand);
    expect((await staffTeams(staff)).map((t) => t.id)).toContain(res.body.id);

    const communities = (await staff.get('/staff/communities')).body as {
      community: { kind: string; teamId?: string };
    }[];
    const own = communities.filter(
      (c) => c.community.kind === 'team' && c.community.teamId === res.body.id,
    );
    expect(own).toHaveLength(1);

    // Waiting on a coach, so nobody can find it to join yet.
    const athlete = await as('athlete', true);
    expect(await joinSearch(athlete)).not.toContain(res.body.id);

    expect(logged('team.created')).toEqual([
      expect.objectContaining({
        userId: USERS.staff.id,
        subjectId: null,
        properties: { teamId: res.body.id },
      }),
    ]);
  });

  it('sends the first coach a 7-day invite for their email, which makes the team live', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    const team = (await staff.post('/staff/teams', hockey)).body;
    const { coaches, invites } = (await staff.get(`/staff/teams/${team.id}/coaches`)).body;
    expect(coaches).toEqual([]);
    expect(invites).toHaveLength(1);
    const invite = invites[0] as InviteOut;
    expect(invite).toMatchObject({
      teamId: team.id,
      email: 'pat.lee@tufts.edu',
      invitedBy: { id: USERS.staff.id },
      acceptedAt: null,
      revokedAt: null,
    });
    expect(Math.abs(Date.parse(invite.createdAt) - Date.now())).toBeLessThan(MINUTE);
    expect(
      Math.abs(Date.parse(invite.expiresAt) - Date.parse(invite.createdAt) - 7 * DAY),
    ).toBeLessThan(MINUTE);
    expect(w.logged('coach.invited')).toEqual([
      expect.objectContaining({
        userId: USERS.staff.id,
        subjectId: null,
        properties: { teamId: team.id, inviteId: invite.id },
      }),
    ]);

    // Tied to the email it was sent to: someone else signed in can't use it.
    const token = w.tokenOf(invite.id);
    const jordan = await w.as('athlete');
    expect((await jordan.post(`/invites/${token}/accept`, {})).status).toBe(403);

    const pat = await w.acceptAsNewCoach(token, 'Pat', 'Lee');
    expect(pat.res.status).toBe(200);
    expect((await staffTeam(staff, team.id))?.status).toBe('live');
    expect(await coachIdsOf(staff, team.id)).toEqual([pat.id]);
    const athlete = await w.as('athlete', true);
    expect(await joinSearch(athlete)).toContain(team.id);
    // Single use.
    expect((await w.acceptAsNewCoach(token, 'Pat', 'Lee')).res.status).toBe(410);
    expect(w.logged('coach.added')).toEqual([
      expect.objectContaining({
        userId: USERS.staff.id,
        subjectId: pat.id,
        properties: expect.objectContaining({ teamId: team.id, via: 'invite' }),
      }),
    ]);
  });

  it('refuses a sport that isn’t on the list', async () => {
    const { as, world } = await setup();
    const staff = await as('staff');
    const before = (await staffTeams(staff)).length;
    for (const sport of ['Hockey', 'ice hockey', 'Quidditch']) {
      const res = await staff.post('/staff/teams', { ...hockey, sport });
      expect(res.status, sport).toBe(400);
    }
    expect(await staffTeams(staff)).toHaveLength(before);
    expect(world.coachInvites.some((i) => i.email === 'pat.lee@tufts.edu')).toBe(false);
    expect(world.eventsLog).toEqual([]);
  });

  it('refuses a colour neither white nor ink text can be read on, and keeps a readable one', async () => {
    const { as, world } = await setup();
    const staff = await as('staff');
    const before = (await staffTeams(staff)).length;
    for (const color of ['#777777', '#7D7D7D']) {
      const res = await staff.post('/staff/teams', { ...hockey, color });
      expect(res.status, color).toBe(400);
    }
    expect(await staffTeams(staff)).toHaveLength(before);
    expect(world.coachInvites.some((i) => i.email === 'pat.lee@tufts.edu')).toBe(false);
    expect(world.eventsLog).toEqual([]);

    // Just either side of the band: white text reads on #767676, ink on #7E7E7E.
    const light = await staff.post('/staff/teams', { ...hockey, color: '#767676' });
    expect(light.status).toBe(201);
    expect(light.body.color).toBe('#767676');
    const dark = await staff.post('/staff/teams', {
      ...hockey,
      sport: 'Rowing',
      name: "Men's Rowing",
      color: '#7E7E7E',
    });
    expect(dark.status).toBe(201);
    expect(dark.body.color).toBe('#7E7E7E');
  });
});

// Duplicates (S2) ----------------------------------------------------------------------------------

describe('duplicate teams', () => {
  it('blocks a second team with the same college, sport and gender', async () => {
    const { as, world } = await setup();
    const staff = await as('staff');
    const before = (await staffTeams(staff)).length;
    const again = await staff.post('/staff/teams', {
      ...hockey,
      sport: 'Soccer',
      gender: 'women',
      name: 'Jumbos',
    });
    expect(again.status).toBe(409);
    expect(await staffTeams(staff)).toHaveLength(before);
    expect(world.eventsLog).toEqual([]);

    // A different gender or college is a different team.
    const mens = await staff.post('/staff/teams', {
      ...hockey,
      sport: 'Soccer',
      name: "Men's Soccer",
    });
    expect(mens.status).toBe(201);
    const elsewhere = await staff.post('/staff/teams', {
      ...hockey,
      collegeId: NORTHEASTERN,
      sport: 'Soccer',
      gender: 'women',
      name: "Women's Soccer",
    });
    expect(elsewhere.status).toBe(201);
  });

  it('matches a sport whatever its case, for a team made before the sport list', async () => {
    const { as, world } = await setup();
    const soccer = world.teams.find((t) => t.id === SOCCER)!;
    world.teams.push({
      ...soccer,
      id: id(299),
      college: { id: NORTHEASTERN, name: 'Northeastern University' },
      sport: 'soccer',
      gender: 'men',
      name: "Men's soccer",
    });
    const staff = await as('staff');
    const res = await staff.post('/staff/teams', {
      ...hockey,
      collegeId: NORTHEASTERN,
      sport: 'Soccer',
      name: "Men's Soccer",
    });
    expect(res.status).toBe(409);
  });

  it('blocks a duplicate of an archived team, which could be restored', async () => {
    const { as } = await setup();
    const staff = await as('staff');
    expect((await staff.post(`/staff/teams/${SOCCER}/archive`)).status).toBe(200);
    const res = await staff.post('/staff/teams', {
      ...hockey,
      sport: 'Soccer',
      gender: 'women',
      name: "Women's Soccer",
    });
    expect(res.status).toBe(409);
  });

  it('blocks an edit that would turn a team into a duplicate', async () => {
    const { as, logged } = await setup();
    const staff = await as('staff');
    const toSoccer = await staff.patch(`/staff/teams/${BASKETBALL}`, { sport: 'Soccer' });
    expect(toSoccer.status).toBe(409);
    expect((await staffTeam(staff, BASKETBALL))?.sport).toBe('Basketball');

    const neu = (
      await staff.post('/staff/teams', {
        ...hockey,
        collegeId: NORTHEASTERN,
        sport: 'Soccer',
        gender: 'women',
        name: "Women's Soccer",
      })
    ).body;
    const moved = await staff.patch(`/staff/teams/${neu.id}`, { collegeId: TUFTS });
    expect(moved.status).toBe(409);
    expect((await staffTeam(staff, neu.id))?.college.id).toBe(NORTHEASTERN);

    const mens = (await staff.post('/staff/teams', { ...hockey, sport: 'Soccer', name: 'M' })).body;
    const flipped = await staff.patch(`/staff/teams/${mens.id}`, { gender: 'women' });
    expect(flipped.status).toBe(409);
    expect((await staffTeam(staff, mens.id))?.gender).toBe('men');
    expect(logged('team.updated')).toEqual([]);
  });

  it('doesn’t count a team as its own duplicate', async () => {
    const { as } = await setup();
    const staff = await as('staff');
    const res = await staff.patch(`/staff/teams/${SOCCER}`, {
      collegeId: TUFTS,
      sport: 'Soccer',
      gender: 'women',
      name: 'Jumbos Soccer',
    });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Jumbos Soccer');
  });
});

// Team colour on edits (S7, C5) ----------------------------------------------------------------------

describe('team colour on edits', () => {
  it('stores a colour in upper case however it was typed, on every way it can be set', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    const created = await staff.post('/staff/teams', { ...hockey, color: '#3e8ede' });
    expect(created.status).toBe(201);
    expect(created.body.color).toBe('#3E8EDE');
    expect((await staffTeam(staff, created.body.id))?.color).toBe('#3E8EDE');

    const staffEdit = await staff.patch(`/staff/teams/${BASKETBALL}`, { color: '#5a2d82' });
    expect(staffEdit.body.color).toBe('#5A2D82');
    expect((await staffTeam(staff, BASKETBALL))?.color).toBe('#5A2D82');

    const coach = await w.as('coach');
    const coachEdit = await coach.patch(`/teams/${SOCCER}`, { color: '#3e8ede' });
    expect(coachEdit.body.color).toBe('#3E8EDE');
    expect((await staffTeam(staff, SOCCER))?.color).toBe('#3E8EDE');
    // Typing the stored colour in lower case changes nothing, so it isn't logged.
    const before = w.logged('team.updated').length;
    await coach.patch(`/teams/${SOCCER}`, { color: '#3e8ede' });
    await staff.patch(`/staff/teams/${BASKETBALL}`, { color: '#5a2d82' });
    expect(w.logged('team.updated')).toHaveLength(before);
  });

  it('staff can’t save an unreadable colour, but can pick a readable one or clear it', async () => {
    const { as, logged } = await setup();
    const staff = await as('staff');
    expect((await staff.patch(`/staff/teams/${SOCCER}`, { color: '#777777' })).status).toBe(400);
    const withName = await staff.patch(`/staff/teams/${SOCCER}`, {
      name: 'Jumbos Soccer',
      color: '#7D7D7D',
    });
    expect(withName.status).toBe(400);
    expect(await staffTeam(staff, SOCCER)).toMatchObject({
      name: "Women's Soccer",
      color: '#1E3F7B',
    });
    expect(logged('team.updated')).toEqual([]);

    const purple = await staff.patch(`/staff/teams/${SOCCER}`, { color: '#5A2D82' });
    expect(purple.status).toBe(200);
    expect(purple.body.color).toBe('#5A2D82');
    const cleared = await staff.patch(`/staff/teams/${SOCCER}`, { color: null });
    expect(cleared.status).toBe(200);
    expect(resolveTeamColor(cleared.body.color)).toBe(colors.brand);
    expect(logged('team.updated')).toHaveLength(2);
  });

  it('a coach can’t save an unreadable colour either', async () => {
    const { as, logged } = await setup();
    const coach = await as('coach');
    expect((await coach.patch(`/teams/${SOCCER}`, { color: '#777777' })).status).toBe(400);
    const withName = await coach.patch(`/teams/${SOCCER}`, { name: 'Jumbos', color: '#7D7D7D' });
    expect(withName.status).toBe(400);
    const roster = (await coach.get(`/teams/${SOCCER}/members`)).body;
    expect(roster.team).toMatchObject({ name: "Women's Soccer", color: '#1E3F7B' });
    expect(logged('team.updated')).toEqual([]);

    const ink = await coach.patch(`/teams/${SOCCER}`, { color: '#7E7E7E' });
    expect(ink.status).toBe(200);
    expect(ink.body.color).toBe('#7E7E7E');
    const cleared = await coach.patch(`/teams/${SOCCER}`, { color: null });
    expect(cleared.status).toBe(200);
    expect(resolveTeamColor(cleared.body.color)).toBe(colors.brand);
    expect(logged('team.updated')).toEqual([
      expect.objectContaining({
        userId: USERS.coach.id,
        properties: { teamId: SOCCER, fields: ['color'] },
      }),
      expect.objectContaining({
        userId: USERS.coach.id,
        properties: { teamId: SOCCER, fields: ['color'] },
      }),
    ]);
  });
});

// Staff edits (S7) ---------------------------------------------------------------------------------

describe('staff editing a team', () => {
  it('edits every field set at creation, and logs which ones changed', async () => {
    const { as, logged } = await setup();
    const staff = await as('staff');
    const team = (await staff.post('/staff/teams', { ...hockey, collegeId: NORTHEASTERN })).body;
    const edit = {
      collegeId: TUFTS,
      sport: 'Rowing',
      gender: 'women',
      name: "Women's Rowing",
      division: 'I',
      color: '#00563F',
    };
    const res = await staff.patch(`/staff/teams/${team.id}`, edit);
    expect(res.status).toBe(200);
    const expected = {
      college: { id: TUFTS, name: 'Tufts University' },
      sport: 'Rowing',
      gender: 'women',
      name: "Women's Rowing",
      division: 'I',
      color: '#00563F',
    };
    expect(res.body).toMatchObject(expected);
    expect(await staffTeam(staff, team.id)).toMatchObject(expected);

    const updates = logged('team.updated');
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      userId: USERS.staff.id,
      subjectId: null,
      properties: { teamId: team.id },
    });
    const { fields } = updates[0]!.properties as unknown as { fields: string[] };
    expect([...fields].sort()).toEqual(Object.keys(edit).sort());
  });

  it('logs only the fields that changed, and nothing when nothing did', async () => {
    const { as, logged } = await setup();
    const staff = await as('staff');
    // The same colour typed in lower case is no change either.
    const same = await staff.patch(`/staff/teams/${SOCCER}`, {
      name: "Women's Soccer",
      division: 'III',
      color: '#1e3f7b',
    });
    expect(same.status).toBe(200);
    expect(logged('team.updated')).toEqual([]);

    await staff.patch(`/staff/teams/${SOCCER}`, { name: 'Jumbos Soccer', division: 'III' });
    expect(logged('team.updated')).toEqual([
      expect.objectContaining({
        userId: USERS.staff.id,
        properties: { teamId: SOCCER, fields: ['name'] },
      }),
    ]);
  });
});

describe('the team’s community name', () => {
  const communityName = (w: World, teamId: string) =>
    w.world.communities.find((c) => c.kind === 'team' && c.teamId === teamId)?.name;

  it('follows the team when staff rename it or move it to another college', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    const team = (await staff.post('/staff/teams', { ...hockey, collegeId: NORTHEASTERN })).body;
    expect(communityName(w, team.id)).toBe("Northeastern University Men's Ice Hockey");
    await staff.patch(`/staff/teams/${team.id}`, { name: 'Huskies Hockey' });
    expect(communityName(w, team.id)).toBe('Northeastern University Huskies Hockey');
    await staff.patch(`/staff/teams/${team.id}`, { collegeId: TUFTS });
    expect(communityName(w, team.id)).toBe('Tufts University Huskies Hockey');
  });

  it('follows the team when its coach renames it', async () => {
    const w = await setup();
    const coach = await w.as('coach');
    expect((await coach.patch(`/teams/${SOCCER}`, { name: 'Jumbos Soccer' })).status).toBe(200);
    expect(communityName(w, SOCCER)).toBe('Tufts University Jumbos Soccer');
  });

  it('follows the college when staff rename it, for each of its teams and no others', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    const hockeyTeam = (await staff.post('/staff/teams', hockey)).body;
    const elsewhere = (await staff.post('/staff/teams', { ...hockey, collegeId: NORTHEASTERN }))
      .body;

    expect((await staff.put(`/staff/colleges/${TUFTS}`, { name: 'Tufts (Medford)' })).status).toBe(
      200,
    );
    expect(communityName(w, SOCCER)).toBe("Tufts (Medford) Women's Soccer");
    expect(communityName(w, hockeyTeam.id)).toBe("Tufts (Medford) Men's Ice Hockey");
    expect(communityName(w, elsewhere.id)).toBe("Northeastern University Men's Ice Hockey");
    // Members see the new name on their team's community.
    const jordan = await w.as('athlete');
    expect((await jordan.get(`/communities/${SOCCER_COMMUNITY}`)).body.name).toBe(
      "Tufts (Medford) Women's Soccer",
    );

    // A rename refused for clashing with another college changes no community.
    const clash = await staff.put(`/staff/colleges/${NORTHEASTERN}`, { name: 'tufts (medford)' });
    expect(clash.status).toBe(409);
    expect(communityName(w, elsewhere.id)).toBe("Northeastern University Men's Ice Hockey");
  });

  it('takes the surviving college’s name when staff merge a duplicate into it', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    // The survivor was renamed first, so its current name is the one that counts.
    await staff.put(`/staff/colleges/${TUFTS}`, { name: 'Tufts (Medford)' });
    const dup = (await staff.post('/staff/colleges', { name: 'Tufts Univ.' })).body;
    const moved = [
      (await staff.post('/staff/teams', { ...hockey, collegeId: dup.id })).body,
      (
        await staff.post('/staff/teams', {
          ...hockey,
          collegeId: dup.id,
          sport: 'Rowing',
          gender: 'women',
          name: "Women's Rowing",
        })
      ).body,
    ];
    expect(communityName(w, moved[0].id)).toBe("Tufts Univ. Men's Ice Hockey");

    const merged = await staff.post(`/staff/colleges/${dup.id}/merge`, { intoCollegeId: TUFTS });
    expect(merged.status).toBe(200);
    expect(communityName(w, moved[0].id)).toBe("Tufts (Medford) Men's Ice Hockey");
    expect(communityName(w, moved[1].id)).toBe("Tufts (Medford) Women's Rowing");
    // The survivor's own team keeps its name.
    expect(communityName(w, SOCCER)).toBe("Tufts (Medford) Women's Soccer");
  });

  it('leaves community names alone when a merge is refused', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    const dup = (await staff.post('/staff/colleges', { name: 'Tufts Univ.' })).body;
    // Both colleges would then have women's soccer, so the merge can't happen.
    const clashing = (
      await staff.post('/staff/teams', {
        ...hockey,
        collegeId: dup.id,
        sport: 'Soccer',
        gender: 'women',
        name: "Women's Soccer",
      })
    ).body;
    const other = (await staff.post('/staff/teams', { ...hockey, collegeId: dup.id })).body;
    const soccerBefore = communityName(w, SOCCER);

    const merged = await staff.post(`/staff/colleges/${dup.id}/merge`, { intoCollegeId: TUFTS });
    expect(merged.status).toBe(409);
    expect(communityName(w, clashing.id)).toBe("Tufts Univ. Women's Soccer");
    expect(communityName(w, other.id)).toBe("Tufts Univ. Men's Ice Hockey");
    expect(communityName(w, SOCCER)).toBe(soccerBefore);
  });
});

// Archiving (S7) -----------------------------------------------------------------------------------

type Archive = (staff: Client, teamId: string) => ReturnType<Client['post']>;
const archiveWays: [string, Archive][] = [
  ['with the archive action', (staff, teamId) => staff.post(`/staff/teams/${teamId}/archive`)],
  [
    'from the edit form',
    (staff, teamId) => staff.patch(`/staff/teams/${teamId}`, { archived: true }),
  ],
];

describe.each(archiveWays)('archiving a team %s', (_way, archive) => {
  it('takes it out of the join search and takes no new requests', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    const leo = await w.as('athlete', true);
    expect(await joinSearch(leo)).toContain(SOCCER);

    const res = await archive(staff, SOCCER);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('archived');
    expect(await joinSearch(leo)).not.toContain(SOCCER);
    expect(await joinSearch(leo, TUFTS, 'Soccer')).toEqual([]);

    const asked = await leo.post('/join-requests', {
      role: 'athlete',
      teamId: SOCCER,
      classYear: 2028,
    });
    // Answered as if there were no such team to join.
    expect(asked.status).toBe(404);
    expect(w.world.joinRequests.some((r) => r.requester.id === USERS.leo.id)).toBe(false);
  });

  it('declines its pending join requests with a note the requester can see', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    await archive(staff, SOCCER);

    const kai = w.world.joinRequests.find((r) => r.id === KAI_REQUEST)!;
    expect(kai.status).toBe('declined');
    expect(kai.decidedAt).not.toBeNull();
    expect(typeof kai.decisionNote).toBe('string');
    expect(kai.decisionNote!.trim().length).toBeGreaterThan(0);
    // The note is part of the request as the API sends it.
    expect(JoinRequest.parse(kai).decisionNote).toBe(kai.decisionNote);

    const coach = await w.as('coach');
    const waiting = await coach.get(`/teams/${SOCCER}/join-requests`);
    expect(waiting.body).toEqual([]);
    const approve = await coach.post(`/join-requests/${KAI_REQUEST}/decision`, {
      decision: 'approve',
    });
    expect(approve.status).toBe(409);
    expect(w.world.teamIdsOf(USERS.kai.id)).not.toContain(SOCCER);
  });

  it('turns its QR codes off', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    const anon = w.client();
    expect((await anon.get(`/qr/${QR_TOKENS.live}`)).status).toBe(200);

    await archive(staff, SOCCER);
    expect((await anon.get(`/qr/${QR_TOKENS.live}`)).status).toBe(410);
    expect((await anon.get('/qr/JUMBQ7K4')).status).toBe(410);
    const leo = await w.as('athlete', true);
    expect((await leo.post(`/qr/${QR_TOKENS.live}/join`)).status).toBe(410);
    expect(w.world.teamIdsOf(USERS.leo.id)).not.toContain(SOCCER);
    for (const code of w.world.qrCodes.filter((c) => c.teamId === SOCCER)) {
      expect(code.revokedAt, code.token).not.toBeNull();
    }
    const coach = await w.as('coach');
    const fresh = await coach.post(`/teams/${SOCCER}/qr-codes`, { lifetime: 'day' });
    expect(fresh.status).toBe(409);
    expect(w.world.qrCodes.filter((c) => c.teamId === SOCCER && !c.revokedAt)).toEqual([]);
  });

  it('keeps its members, who can still read the roster and the team community', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    await archive(staff, SOCCER);
    for (const role of ['athlete', 'parent', 'teen', 'coach'] as const) {
      const member = await w.as(role);
      const roster = await member.get(`/teams/${SOCCER}/members`);
      expect(roster.status, role).toBe(200);
      expect(roster.body.coaches.map((m: { user: { id: string } }) => m.user.id)).toEqual([
        USERS.coach.id,
      ]);
      expect(
        roster.body.athletes.map((m: { user: { id: string } }) => m.user.id).sort(),
        role,
      ).toEqual([USERS.jordan.id, USERS.sam.id, USERS.riley.id, USERS.ava.id].sort());
      expect((await member.get('/me')).body.teamIds, role).toContain(SOCCER);
      expect((await member.get(`/communities/${SOCCER_COMMUNITY}`)).status, role).toBe(200);
      expect((await member.get(`/communities/${SOCCER_COMMUNITY}/posts`)).status, role).toBe(200);
    }
  });

  it('logs who archived it and what it closed', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    await archive(staff, SOCCER);
    const rows = w.logged('team.archived');
    expect(rows).toEqual([
      expect.objectContaining({
        userId: USERS.staff.id,
        subjectId: null,
        properties: expect.objectContaining({ teamId: SOCCER, declinedRequestCount: 1 }),
      }),
    ]);
    // Soccer had one working code; its expired one is turned off too but wasn't closed by this.
    const { revokedCodeCount } = rows[0]!.properties as unknown as { revokedCodeCount: number };
    expect(revokedCodeCount).toBe(1);
  });

  it('archiving twice changes nothing more and logs it once', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    await archive(staff, SOCCER);
    const again = await archive(staff, SOCCER);
    expect(again.status).toBe(200);
    expect(again.body.status).toBe('archived');
    expect(w.logged('team.archived')).toHaveLength(1);
  });

  it('stops its coach invites from being accepted', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    await archive(staff, LACROSSE);
    expect((await w.client().get(`/invites/${INVITE_TOKENS.lacrosse}`)).status).toBe(410);
    const pat = await w.acceptAsNewCoach(INVITE_TOKENS.lacrosse, 'Pat', 'Nguyen');
    expect(pat.res.status).toBe(410);
    expect(w.world.users.some((u) => u.email === 'pat.nguyen@tufts.edu')).toBe(false);
    expect((await staffTeam(staff, LACROSSE))?.status).toBe('archived');
    expect(await coachIdsOf(staff, LACROSSE)).toEqual([]);
    expect(w.logged('coach.added')).toEqual([]);
  });
});

// Restoring (S7) -----------------------------------------------------------------------------------

describe('restoring a team', () => {
  it('brings a team with a coach back live and into the join search, its old codes still off', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    await staff.post(`/staff/teams/${SOCCER}/archive`);
    const res = await staff.patch(`/staff/teams/${SOCCER}`, { archived: false });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('live');
    const leo = await w.as('athlete', true);
    expect(await joinSearch(leo)).toContain(SOCCER);

    const anon = w.client();
    expect((await anon.get(`/qr/${QR_TOKENS.live}`)).status).toBe(410);
    expect((await leo.post(`/qr/${QR_TOKENS.live}/join`)).status).toBe(410);
    expect(w.world.teamIdsOf(USERS.leo.id)).not.toContain(SOCCER);

    // The coach makes a new code, and that one works.
    const coach = await w.as('coach');
    const fresh = await coach.post(`/teams/${SOCCER}/qr-codes`, { lifetime: 'day' });
    expect(fresh.status).toBe(201);
    expect((await anon.get(`/qr/${fresh.body.token}`)).status).toBe(200);

    expect(w.logged('team.restored')).toEqual([
      expect.objectContaining({
        userId: USERS.staff.id,
        subjectId: null,
        properties: { teamId: SOCCER },
      }),
    ]);
  });

  it('puts a team without a coach back to waiting on one', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    for (const teamId of [LACROSSE, BASKETBALL]) {
      await staff.post(`/staff/teams/${teamId}/archive`);
      const res = await staff.patch(`/staff/teams/${teamId}`, { archived: false });
      expect(res.status, teamId).toBe(200);
      // A live team always has a coach, and neither has one.
      expect(res.body.status, teamId).toBe('invited');
    }
    const leo = await w.as('athlete', true);
    const found = await joinSearch(leo);
    expect(found).not.toContain(LACROSSE);
    expect(found).not.toContain(BASKETBALL);

    // Only the QR codes stay off: lacrosse's first coach can still accept, making it live.
    const pat = await w.acceptAsNewCoach(INVITE_TOKENS.lacrosse, 'Pat', 'Nguyen');
    expect(pat.res.status).toBe(200);
    expect((await staffTeam(staff, LACROSSE))?.status).toBe('live');
  });

  it('doesn’t go live on a coach who is suspended', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    await staff.post(`/staff/teams/${SOCCER}/archive`);
    // Archived, so Dana isn't a live team's last coach and can be suspended.
    expect((await suspendDana(w, staff)).status).toBe(200);
    const res = await staff.patch(`/staff/teams/${SOCCER}`, { archived: false });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('invited');
    expect(await joinSearch(await w.as('athlete', true))).not.toContain(SOCCER);
  });

  it('goes live once its suspended coach is restored, and the coach can make codes again', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    await staff.post(`/staff/teams/${SOCCER}/archive`);
    expect((await suspendDana(w, staff)).status).toBe(200);
    expect((await staff.patch(`/staff/teams/${SOCCER}`, { archived: false })).body.status).toBe(
      'invited',
    );

    expect((await staff.post(`/staff/users/${USERS.coach.id}/unsuspend`)).status).toBe(200);
    expect((await staffTeam(staff, SOCCER))?.status).toBe('live');
    expect(await joinSearch(await w.as('athlete', true))).toContain(SOCCER);
    const dana = await w.as('coach');
    const code = await dana.post(`/teams/${SOCCER}/qr-codes`, { lifetime: 'day' });
    expect(code.status).toBe(201);
    expect((await w.client().get(`/qr/${code.body.token}`)).status).toBe(200);
  });

  it('stays archived when its suspended coach is restored before the team is', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    await staff.post(`/staff/teams/${SOCCER}/archive`);
    expect((await suspendDana(w, staff)).status).toBe(200);
    expect((await staff.post(`/staff/users/${USERS.coach.id}/unsuspend`)).status).toBe(200);
    expect((await staffTeam(staff, SOCCER))?.status).toBe('archived');
    expect(await joinSearch(await w.as('athlete', true))).not.toContain(SOCCER);
    // Restoring it now finds an active coach.
    const res = await staff.patch(`/staff/teams/${SOCCER}`, { archived: false });
    expect(res.body.status).toBe('live');
  });
});

// Coaches and invites (S8) -------------------------------------------------------------------------

describe('a team’s coaches and invites', () => {
  it('lists its coaches and its invites with when each was sent and when it expires', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    const before = await staff.get(`/staff/teams/${SOCCER}/coaches`);
    expect(before.status).toBe(200);
    expect(before.body.coaches).toEqual([
      expect.objectContaining({ user: expect.objectContaining({ id: USERS.coach.id }) }),
    ]);
    expect(Number.isNaN(Date.parse(before.body.coaches[0].joinedAt))).toBe(false);

    const sent = await staff.post(`/staff/teams/${SOCCER}/coach-invites`, {
      email: 'Assistant.Coach@Tufts.edu',
    });
    expect(sent.status).toBe(201);
    const invites = await invitesOf(staff, SOCCER);
    expect(invites.map((i) => i.id)).toEqual(
      expect.arrayContaining([sent.body.id, REVOKED_INVITE, EXPIRED_INVITE]),
    );
    for (const i of invites) {
      expect(Number.isNaN(Date.parse(i.createdAt)), i.email).toBe(false);
      expect(Number.isNaN(Date.parse(i.expiresAt)), i.email).toBe(false);
    }
    const fresh = invites.find((i) => i.id === sent.body.id)!;
    expect(fresh).toMatchObject({
      email: 'assistant.coach@tufts.edu',
      invitedBy: { id: USERS.staff.id },
      acceptedAt: null,
      revokedAt: null,
    });
    expect(Math.abs(Date.parse(fresh.createdAt) - Date.now())).toBeLessThan(MINUTE);
    expect(
      Math.abs(Date.parse(fresh.expiresAt) - Date.parse(fresh.createdAt) - 7 * DAY),
    ).toBeLessThan(MINUTE);
    const expired = invites.find((i) => i.id === EXPIRED_INVITE)!;
    expect(Date.parse(expired.expiresAt)).toBeLessThan(Date.now());

    // The links themselves only go out by email.
    const listing = (await staff.get(`/staff/teams/${SOCCER}/coaches`)).text;
    expect(listing).not.toContain(w.tokenOf(sent.body.id));
    expect(listing).not.toContain(INVITE_TOKENS.expired);

    expect(w.logged('coach.invited')).toEqual([
      expect.objectContaining({
        userId: USERS.staff.id,
        subjectId: null,
        properties: { teamId: SOCCER, inviteId: sent.body.id },
      }),
    ]);
  });

  it('staff invite another coach, who joins the team on accepting', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    const sent = await staff.post(`/staff/teams/${SOCCER}/coach-invites`, {
      email: 'assistant.coach@tufts.edu',
    });
    const robin = await w.acceptAsNewCoach(w.tokenOf(sent.body.id), 'Robin', 'Assistant');
    expect(robin.res.status).toBe(200);
    expect(await coachIdsOf(staff, SOCCER)).toEqual([USERS.coach.id, robin.id].sort());
    const accepted = (await invitesOf(staff, SOCCER)).find((i) => i.id === sent.body.id)!;
    expect(accepted.acceptedAt).not.toBeNull();
    expect(w.logged('coach.added')).toEqual([
      expect.objectContaining({
        userId: USERS.staff.id,
        subjectId: robin.id,
        properties: expect.objectContaining({ teamId: SOCCER, via: 'invite' }),
      }),
    ]);
  });

  it('resending sends a fresh 7-day link to the same email and turns the old one off', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    const res = await staff.post(`/staff/coach-invites/${LACROSSE_INVITE}/resend`);
    expect(res.status).toBe(201);
    expect(res.body.id).not.toBe(LACROSSE_INVITE);
    expect(res.body).toMatchObject({
      teamId: LACROSSE,
      email: 'pat.nguyen@tufts.edu',
      acceptedAt: null,
      revokedAt: null,
    });
    expect(Math.abs(Date.parse(res.body.expiresAt) - Date.now() - 7 * DAY)).toBeLessThan(MINUTE);

    const anon = w.client();
    expect((await anon.get(`/invites/${INVITE_TOKENS.lacrosse}`)).status).toBe(410);
    expect((await w.acceptAsNewCoach(INVITE_TOKENS.lacrosse, 'Pat', 'Nguyen')).res.status).toBe(
      410,
    );
    const invites = await invitesOf(staff, LACROSSE);
    expect(invites.find((i) => i.id === LACROSSE_INVITE)?.revokedAt).not.toBeNull();

    const token = w.tokenOf(res.body.id);
    expect(token).not.toBe(INVITE_TOKENS.lacrosse);
    expect((await anon.get(`/invites/${token}`)).status).toBe(200);
    const pat = await w.acceptAsNewCoach(token, 'Pat', 'Nguyen');
    expect(pat.res.status).toBe(200);
    expect((await staffTeam(staff, LACROSSE))?.status).toBe('live');

    expect(w.logged('coach.invited')).toEqual([
      expect.objectContaining({
        userId: USERS.staff.id,
        subjectId: null,
        properties: { teamId: LACROSSE, inviteId: res.body.id, replacesInviteId: LACROSSE_INVITE },
      }),
    ]);
  });

  it('resends an invite that expired, leaving the old one expired', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    const res = await staff.post(`/staff/coach-invites/${EXPIRED_INVITE}/resend`);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      teamId: SOCCER,
      email: 'jamie.cole@tufts.edu',
      invitedBy: { id: USERS.staff.id },
      acceptedAt: null,
      revokedAt: null,
    });
    expect(Math.abs(Date.parse(res.body.expiresAt) - Date.now() - 7 * DAY)).toBeLessThan(MINUTE);
    expect((await w.client().get(`/invites/${w.tokenOf(res.body.id)}`)).status).toBe(200);
    expect((await w.client().get(`/invites/${INVITE_TOKENS.expired}`)).status).toBe(410);
    const old = (await invitesOf(staff, SOCCER)).find((i) => i.id === EXPIRED_INVITE)!;
    expect(old.revokedAt).toBeNull();
    expect(Date.parse(old.expiresAt)).toBeLessThan(Date.now());
    expect(w.logged('coach.invited')).toEqual([
      expect.objectContaining({
        userId: USERS.staff.id,
        subjectId: null,
        properties: { teamId: SOCCER, inviteId: res.body.id, replacesInviteId: EXPIRED_INVITE },
      }),
    ]);
  });

  it('only resends the newest invite to an email: an expired one replaced since stays history', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    const first = await staff.post(`/staff/coach-invites/${EXPIRED_INVITE}/resend`);
    expect(first.status).toBe(201);
    expect((await staff.post(`/staff/coach-invites/${first.body.id}/revoke`)).status).toBe(200);

    // The old expired invite is no longer the newest to Jamie, so it can't bring a link back.
    expect((await staff.post(`/staff/coach-invites/${EXPIRED_INVITE}/resend`)).status).toBe(409);
    // Nor can the withdrawn replacement.
    expect((await staff.post(`/staff/coach-invites/${first.body.id}/resend`)).status).toBe(409);
    const jamie = (await invitesOf(staff, SOCCER)).filter(
      (i) => i.email === 'jamie.cole@tufts.edu',
    );
    expect(jamie.map((i) => i.id).sort()).toEqual([EXPIRED_INVITE, first.body.id].sort());
    expect(
      jamie.filter((i) => !i.revokedAt && !i.acceptedAt && Date.parse(i.expiresAt) > Date.now()),
    ).toEqual([]);
    expect(w.logged('coach.invited')).toHaveLength(1);
  });

  it('counts newer invites per team: one to the same email on another team doesn’t block a resend', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    const lacrosse = await staff.post(`/staff/teams/${LACROSSE}/coach-invites`, {
      email: 'jamie.cole@tufts.edu',
    });
    expect(lacrosse.status).toBe(201);
    const res = await staff.post(`/staff/coach-invites/${EXPIRED_INVITE}/resend`);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ teamId: SOCCER, email: 'jamie.cole@tufts.edu' });
  });

  it('won’t invite a coach to an archived team, from staff or its coach', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    await staff.post(`/staff/teams/${SOCCER}/archive`);
    const before = (await invitesOf(staff, SOCCER)).length;
    const fromStaff = await staff.post(`/staff/teams/${SOCCER}/coach-invites`, {
      email: 'assistant.coach@tufts.edu',
    });
    expect(fromStaff.status).toBe(400);
    const coach = await w.as('coach');
    const fromCoach = await coach.post(`/teams/${SOCCER}/coach-invites`, {
      email: 'assistant.coach@tufts.edu',
    });
    expect(fromCoach.status).toBe(400);
    expect(await invitesOf(staff, SOCCER)).toHaveLength(before);
    expect(w.logged('coach.invited')).toEqual([]);
  });

  it('won’t resend an invite on an archived team, and leaves the old one to work after restoring', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    await staff.post(`/staff/teams/${LACROSSE}/archive`);
    const res = await staff.post(`/staff/coach-invites/${LACROSSE_INVITE}/resend`);
    expect(res.status).toBe(400);
    const invites = await invitesOf(staff, LACROSSE);
    expect(invites.map((i) => i.id)).toEqual([LACROSSE_INVITE]);
    expect(invites[0]!.revokedAt).toBeNull();
    expect(w.logged('coach.invited')).toEqual([]);

    await staff.patch(`/staff/teams/${LACROSSE}`, { archived: false });
    expect((await w.client().get(`/invites/${INVITE_TOKENS.lacrosse}`)).status).toBe(200);
    expect((await w.acceptAsNewCoach(INVITE_TOKENS.lacrosse, 'Pat', 'Nguyen')).res.status).toBe(
      200,
    );
  });

  it('won’t resend an invite that was already accepted', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    expect((await w.acceptAsNewCoach(INVITE_TOKENS.lacrosse, 'Pat', 'Nguyen')).res.status).toBe(
      200,
    );
    const res = await staff.post(`/staff/coach-invites/${LACROSSE_INVITE}/resend`);
    expect(res.status).toBe(400);
    expect((await invitesOf(staff, LACROSSE)).map((i) => i.id)).toEqual([LACROSSE_INVITE]);
    expect(w.logged('coach.invited')).toEqual([]);
  });

  it('won’t resend a withdrawn invite, or one an earlier resend already replaced', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    expect((await staff.post(`/staff/coach-invites/${REVOKED_INVITE}/resend`)).status).toBe(409);
    const first = await staff.post(`/staff/coach-invites/${LACROSSE_INVITE}/resend`);
    expect(first.status).toBe(201);
    expect((await staff.post(`/staff/coach-invites/${LACROSSE_INVITE}/resend`)).status).toBe(409);
    // Only the one resend went out: one live link for Pat.
    const pending = (await invitesOf(staff, LACROSSE)).filter(
      (i) => !i.revokedAt && !i.acceptedAt && Date.parse(i.expiresAt) > Date.now(),
    );
    expect(pending.map((i) => i.id)).toEqual([first.body.id]);
    expect(w.logged('coach.invited')).toHaveLength(1);
  });

  it('staff revoke an invite and its link stops working', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    const res = await staff.post(`/staff/coach-invites/${LACROSSE_INVITE}/revoke`);
    expect(res.status).toBe(200);
    expect(res.body.revokedAt).not.toBeNull();
    expect((await w.client().get(`/invites/${INVITE_TOKENS.lacrosse}`)).status).toBe(410);
    expect((await w.acceptAsNewCoach(INVITE_TOKENS.lacrosse, 'Pat', 'Nguyen')).res.status).toBe(
      410,
    );
    expect(
      (await invitesOf(staff, LACROSSE)).find((i) => i.id === LACROSSE_INVITE)?.revokedAt,
    ).not.toBeNull();
    expect(w.logged('coach.invite_revoked')).toEqual([
      expect.objectContaining({
        userId: USERS.staff.id,
        subjectId: null,
        properties: { teamId: LACROSSE, inviteId: LACROSSE_INVITE },
      }),
    ]);
  });

  it('a coach revokes an invite to their team, but not one to another team', async () => {
    const w = await setup();
    const coach = await w.as('coach');
    const sent = await coach.post(`/teams/${SOCCER}/coach-invites`, {
      email: 'assistant.coach@tufts.edu',
    });
    const res = await coach.post(`/coach-invites/${sent.body.id}/revoke`);
    expect(res.status).toBe(200);
    expect(res.body.revokedAt).not.toBeNull();
    expect((await w.client().get(`/invites/${w.tokenOf(sent.body.id)}`)).status).toBe(410);
    expect(w.logged('coach.invite_revoked')).toEqual([
      expect.objectContaining({
        userId: USERS.coach.id,
        properties: { teamId: SOCCER, inviteId: sent.body.id },
      }),
    ]);

    // Dana doesn't coach lacrosse, so she learns nothing about it.
    const other = await coach.post(`/coach-invites/${LACROSSE_INVITE}/revoke`);
    expect(other.status).toBe(404);
    expect((await w.client().get(`/invites/${INVITE_TOKENS.lacrosse}`)).status).toBe(200);
    expect(w.logged('coach.invite_revoked')).toHaveLength(1);
  });

  it('won’t revoke an invite that was already accepted', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    const pat = await w.acceptAsNewCoach(INVITE_TOKENS.lacrosse, 'Pat', 'Nguyen');
    const res = await staff.post(`/staff/coach-invites/${LACROSSE_INVITE}/revoke`);
    expect(res.status).toBe(400);
    expect(await coachIdsOf(staff, LACROSSE)).toEqual([pat.id]);
    expect(w.logged('coach.invite_revoked')).toEqual([]);
  });
});

// Removing coaches (S8) ----------------------------------------------------------------------------

describe('removing a coach', () => {
  it('staff remove a coach while the team has another, logged against that coach', async () => {
    const w = await setup();
    const { assistant } = await addAssistant(w);
    const staff = await w.as('staff');
    expect(await coachIdsOf(staff, SOCCER)).toEqual([USERS.coach.id, assistant.id].sort());

    const res = await staff.del(`/teams/${SOCCER}/members/${assistant.id}`);
    expect(res.status).toBe(200);
    expect(await coachIdsOf(staff, SOCCER)).toEqual([USERS.coach.id]);
    expect(w.world.teamIdsOf(assistant.id)).not.toContain(SOCCER);
    expect(w.logged('coach.removed')).toEqual([
      expect.objectContaining({
        userId: USERS.staff.id,
        subjectId: assistant.id,
        properties: { teamId: SOCCER },
      }),
    ]);
  });

  it('a coach removes another coach, logged as theirs', async () => {
    const w = await setup();
    const { dana, assistant } = await addAssistant(w);
    expect((await dana.del(`/teams/${SOCCER}/members/${assistant.id}`)).status).toBe(200);
    expect(w.logged('coach.removed')).toEqual([
      expect.objectContaining({
        userId: USERS.coach.id,
        subjectId: assistant.id,
        properties: { teamId: SOCCER },
      }),
    ]);
  });

  it('won’t remove a live team’s last coach', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    const res = await staff.del(`/teams/${SOCCER}/members/${USERS.coach.id}`);
    expect(res.status).toBe(409);
    expect(await coachIdsOf(staff, SOCCER)).toEqual([USERS.coach.id]);
    expect(w.logged('coach.removed')).toEqual([]);
  });

  it('won’t let the last coach go after the other was removed', async () => {
    const w = await setup();
    const { assistant } = await addAssistant(w);
    const staff = await w.as('staff');
    expect((await staff.del(`/teams/${SOCCER}/members/${USERS.coach.id}`)).status).toBe(200);
    expect((await staff.del(`/teams/${SOCCER}/members/${assistant.id}`)).status).toBe(409);
    expect(await coachIdsOf(staff, SOCCER)).toEqual([assistant.id]);
  });

  it('counts only coaches who can act: a suspended one doesn’t let the last active coach go', async () => {
    const w = await setup();
    const { dana, assistant } = await addAssistant(w);
    const staffUser = w.world.user(USERS.staff.id)!;
    expect(suspend(w.world, staffUser, w.world.user(assistant.id)!)).toBeNull();
    const staff = await w.as('staff');
    // Staff see who can't act.
    const coaches = (await staff.get(`/staff/teams/${SOCCER}/coaches`)).body.coaches as {
      user: { id: string };
      suspended: boolean;
    }[];
    expect(Object.fromEntries(coaches.map((c) => [c.user.id, c.suspended]))).toEqual({
      [USERS.coach.id]: false,
      [assistant.id]: true,
    });

    expect((await staff.del(`/teams/${SOCCER}/members/${USERS.coach.id}`)).status).toBe(409);
    expect((await dana.del('/me')).status).toBe(409);
    expect((await suspendDana(w, staff)).status).toBe(409);
    expect((await dana.get('/me')).status).toBe(200);
    expect(await coachIdsOf(staff, SOCCER)).toContain(USERS.coach.id);

    // The suspended coach can be taken off; Dana stays.
    expect((await staff.del(`/teams/${SOCCER}/members/${assistant.id}`)).status).toBe(200);
    expect(await coachIdsOf(staff, SOCCER)).toEqual([USERS.coach.id]);
  });

  it('lets a coach be suspended or close their account while another coach remains, then not', async () => {
    const w = await setup();
    const { dana, assistant } = await addAssistant(w);
    const staff = await w.as('staff');
    // Robin can still act, so Dana can be suspended...
    expect((await suspendDana(w, staff)).status).toBe(200);
    expect((await dana.get('/me')).status).toBe(403);
    // ...which leaves Robin as the only coach who can: they can't leave or be removed.
    expect((await assistant.del('/me')).status).toBe(409);
    expect((await staff.del(`/teams/${SOCCER}/members/${assistant.id}`)).status).toBe(409);
    expect(w.world.teamIdsOf(assistant.id)).toContain(SOCCER);
  });

  it('lets a coach close their account while another active coach remains', async () => {
    const w = await setup();
    const { assistant } = await addAssistant(w);
    expect((await assistant.del('/me')).status).toBe(204);
    const staff = await w.as('staff');
    expect(await coachIdsOf(staff, SOCCER)).toEqual([USERS.coach.id]);
    // And now Dana is the last one again.
    expect((await (await w.as('coach')).del('/me')).status).toBe(409);
  });
});

// The events log ----------------------------------------------------------------------------------

describe('team onboarding in the events log', () => {
  it('writes every create, edit, archive and coach change with who made it, and no names or emails', async () => {
    const w = await setup();
    const staff = await w.as('staff');
    const team = (await staff.post('/staff/teams', hockey)).body;
    await staff.patch(`/staff/teams/${team.id}`, { name: 'Jumbos Ice Hockey', color: '#5A2D82' });
    const [first] = await invitesOf(staff, team.id);
    const resent = (await staff.post(`/staff/coach-invites/${first!.id}/resend`)).body;
    const pat = await w.acceptAsNewCoach(w.tokenOf(resent.id), 'Pat', 'Lee');
    expect(pat.res.status).toBe(200);

    // Pat, now the coach, invites one assistant and withdraws it, then invites another.
    const dropped = (
      await pat.post(`/teams/${team.id}/coach-invites`, { email: 'alex.moore@tufts.edu' })
    ).body;
    expect((await pat.post(`/coach-invites/${dropped.id}/revoke`)).status).toBe(200);
    const kept = (
      await pat.post(`/teams/${team.id}/coach-invites`, { email: 'riley.chen@tufts.edu' })
    ).body;
    const riley = await w.acceptAsNewCoach(w.tokenOf(kept.id), 'Riley', 'Chen');
    expect(riley.res.status).toBe(200);
    expect((await pat.patch(`/teams/${team.id}`, { about: 'Jumbos on ice.' })).status).toBe(200);

    expect((await staff.del(`/teams/${team.id}/members/${riley.id}`)).status).toBe(200);
    await staff.post(`/staff/teams/${team.id}/archive`);
    await staff.patch(`/staff/teams/${team.id}`, { archived: false });

    const onboarding: TrackedEventName[] = [
      'team.created',
      'team.updated',
      'team.archived',
      'team.restored',
      'coach.invited',
      'coach.invite_revoked',
      'coach.added',
      'coach.removed',
    ];
    const rows = w.world.eventsLog
      .filter((e) => onboarding.includes(e.event))
      .map((e) => ({
        event: e.event,
        userId: e.userId,
        subjectId: e.subjectId,
        teamId: (e.properties as { teamId: string }).teamId,
      }));
    const row = (event: TrackedEventName, userId: string, subjectId: string | null = null) => ({
      event,
      userId,
      subjectId,
      teamId: team.id,
    });
    expect(rows).toEqual(
      expect.arrayContaining([
        row('team.created', USERS.staff.id),
        row('coach.invited', USERS.staff.id),
        row('team.updated', USERS.staff.id),
        row('coach.added', USERS.staff.id, pat.id),
        row('coach.invited', pat.id),
        row('coach.invite_revoked', pat.id),
        row('coach.added', pat.id, riley.id),
        row('team.updated', pat.id),
        row('coach.removed', USERS.staff.id, riley.id),
        row('team.archived', USERS.staff.id),
        row('team.restored', USERS.staff.id),
      ]),
    );
    // The first invite and its resend are both on record, each as staff's.
    expect(
      rows.filter((r) => r.event === 'coach.invited' && r.userId === USERS.staff.id),
    ).toHaveLength(2);
    for (const r of rows) {
      expect(r.userId, r.event).toBeTruthy();
      expect(r.teamId, r.event).toBe(team.id);
    }

    expectNoPersonalData(w.world, [
      'Pat',
      'Lee',
      'Riley',
      'Chen',
      'Alex',
      'Moore',
      'Maya',
      'Tufts',
      'Hockey',
      'Jumbos',
      'on ice',
      '#5A2D82',
    ]);
  });
});
