import { afterEach, describe, expect, it } from 'vitest';
import { MEMBERS_PRIVATE_MEDICAL, type FeatureFlags, type Role } from '@team-impact/contracts';
import { buildApp } from '../app';
import { communityEvents, communityMembers } from './community-members';
import { CHILDREN, id, USERS } from './fixtures';
import { MockWorld } from './world';

const TEAM = id(301);
const TEAM_IMPACT = id(302);
const MEDICAL = id(303);
const FIRST_GEN = id(304); // official interest community; Noah (a teen) is a member
const FINANCE = id(305); // open interest community, Jordan isn't in it
const CAPTAINS = id(307); // private interest community: Coach Rivera and Jordan

const FLAGS: FeatureFlags = { identitySearch: true, medicalCommunities: true };

let close: (() => Promise<void>) | undefined;
afterEach(() => close?.());

/** A fresh mock API, signed in as `role`'s fixture user. */
const signIn = async (role: Role, flags?: FeatureFlags) => {
  const app = await buildApp({ sessionSecret: 'x'.repeat(32), corsOrigins: [], mock: true, flags });
  close = () => app.close();
  const res = await app.inject({ method: 'POST', url: '/auth/dev-sign-in', payload: { role } });
  expect(res.statusCode).toBe(200);
  const cookie = res.cookies[0]!;
  const call = async (method: 'GET' | 'POST', url: string) => {
    const r = await app.inject({ method, url, cookies: { [cookie.name]: cookie.value } });
    return { status: r.statusCode, body: r.json() };
  };
  return { get: (url: string) => call('GET', url), post: (url: string) => call('POST', url) };
};

const memberIds = (body: { user: { id: string } }[]) => body.map((m) => m.user.id);

describe('community members: who is listed', () => {
  it('lists a team community’s members, coaches first, with roles', async () => {
    const { get } = await signIn('athlete');
    const res = await get(`/communities/${TEAM}/members`);
    expect(res.status).toBe(200);
    expect(res.body[0].user).toMatchObject({ id: USERS.coach.id, role: 'coach' });
    expect(memberIds(res.body)).toEqual(
      expect.arrayContaining([USERS.jordan.id, USERS.sam.id, USERS.lisa.id, USERS.noah.id]),
    );
  });

  it('never lists children, who are profiles run by a parent, not members', async () => {
    const { get } = await signIn('parent');
    const res = await get(`/communities/${TEAM}/members`);
    expect(res.status).toBe(200);
    const listed = memberIds(res.body);
    for (const child of CHILDREN) expect(listed).not.toContain(child.id);
    expect(JSON.stringify(res.body)).not.toContain(CHILDREN[0]!.firstName);
  });

  it('lists teens only in their own team’s community', async () => {
    const athlete = await signIn('athlete');
    expect(memberIds((await athlete.get(`/communities/${TEAM}/members`)).body)).toContain(
      USERS.noah.id,
    );
    const firstGen = await athlete.get(`/communities/${FIRST_GEN}/members`);
    expect(firstGen.status).toBe(200);
    expect(memberIds(firstGen.body)).toContain(USERS.priya.id);
    expect(memberIds(firstGen.body)).not.toContain(USERS.noah.id);
    await close?.();

    const teen = await signIn('teen');
    const own = await teen.get(`/communities/${TEAM}/members`);
    expect(own.status).toBe(200);
    expect(memberIds(own.body)).toContain(USERS.noah.id);
  });

  it('never shows a team’s members to anyone outside it', () => {
    const world = new MockWorld(FLAGS);
    const team = world.communities.find((c) => c.id === TEAM)!;
    expect(communityMembers(world, team, world.user(USERS.priya.id)!)).toMatchObject({
      status: 403,
    });
  });

  it('never lists a medical community’s members, to anyone', async () => {
    for (const role of ['parent', 'athlete', 'staff', 'coach'] as const) {
      const { get } = await signIn(role);
      const res = await get(`/communities/${MEDICAL}/members`);
      expect(res.status, role).toBe(403);
      expect(res.body.error.message, role).toBe(MEMBERS_PRIVATE_MEDICAL);
      await close?.();
    }
    // Teens can't even learn it exists.
    const teen = await signIn('teen');
    expect((await teen.get(`/communities/${MEDICAL}/members`)).status).toBe(404);
  });

  it('hides medical communities entirely when the switch is off', async () => {
    const { get } = await signIn('parent', { ...FLAGS, medicalCommunities: false });
    expect((await get(`/communities/${MEDICAL}/members`)).status).toBe(404);
    expect((await get(`/communities/${MEDICAL}/events`)).status).toBe(404);
  });

  it('shows only a count for the Team Impact community', async () => {
    const { get } = await signIn('athlete');
    expect((await get(`/communities/${TEAM_IMPACT}/members`)).status).toBe(403);
    const community = await get(`/communities/${TEAM_IMPACT}`);
    expect(community.body.memberCount).toBeGreaterThan(0);
  });

  it('shows recruiters the members of nothing', async () => {
    const { get } = await signIn('recruiter');
    for (const c of [TEAM_IMPACT, FIRST_GEN]) {
      expect((await get(`/communities/${c}/members`)).status, c).toBe(403);
    }
    // Team communities don't exist for them at all.
    expect((await get(`/communities/${TEAM}/members`)).status).toBe(404);
  });

  it('keeps a private community’s members to its members', async () => {
    const { get } = await signIn('athlete');
    const mine = await get(`/communities/${CAPTAINS}/members`);
    expect(mine.status).toBe(200);
    expect(memberIds(mine.body).sort()).toEqual([USERS.coach.id, USERS.jordan.id].sort());

    const world = new MockWorld(FLAGS);
    const captains = world.communities.find((c) => c.id === CAPTAINS)!;
    const asker = world.user(USERS.sam.id)!; // asked to join, not yet approved
    expect(communityMembers(world, captains, asker)).toMatchObject({ status: 403 });
    expect(communityEvents(world, captains, asker)).toEqual([]);
  });

  it('shows open communities’ members to members only', async () => {
    const { get } = await signIn('athlete');
    expect((await get(`/communities/${FINANCE}/members`)).status).toBe(403);
  });

  it('leaves out people the viewer blocked, and people who blocked them', async () => {
    const { get, post } = await signIn('athlete');
    expect((await post(`/blocks/${USERS.sam.id}`)).status).toBe(201);
    expect(memberIds((await get(`/communities/${TEAM}/members`)).body)).not.toContain(USERS.sam.id);

    const world = new MockWorld(FLAGS);
    world.blocks.push({
      blockerId: USERS.sam.id,
      blockedId: USERS.jordan.id,
      createdAt: new Date().toISOString(),
    });
    const team = world.communities.find((c) => c.id === TEAM)!;
    const seen = communityMembers(world, team, world.user(USERS.jordan.id)!);
    expect('members' in seen && memberIds(seen.members)).not.toContain(USERS.sam.id);
  });
});

describe('community events', () => {
  it('lists the community’s approved events', async () => {
    const { get } = await signIn('athlete');
    const team = await get(`/communities/${TEAM}/events`);
    expect(team.status).toBe(200);
    expect(team.body.map((e: { id: string }) => e.id)).toContain(id(501));
    for (const e of team.body) expect(e.community.id).toBe(TEAM);
  });

  it('leaves out events from people the viewer blocked', async () => {
    const { get, post } = await signIn('athlete');
    expect((await get(`/communities/${FIRST_GEN}/events`)).body.length).toBeGreaterThan(0);
    await post(`/blocks/${USERS.priya.id}`);
    const after = await get(`/communities/${FIRST_GEN}/events`);
    expect(after.body.map((e: { id: string }) => e.id)).not.toContain(id(503));
  });

  it('shows nothing from a community the viewer doesn’t read', async () => {
    const { get } = await signIn('athlete');
    expect((await get(`/communities/${FINANCE}/events`)).body).toEqual([]);
  });

  it('never reveals a medical community to teens', async () => {
    const { get } = await signIn('teen');
    expect((await get(`/communities/${MEDICAL}/events`)).status).toBe(404);
  });
});
