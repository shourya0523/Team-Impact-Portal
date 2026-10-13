import { afterEach, describe, expect, it } from 'vitest';
import type { Role } from '@team-impact/contracts';
import { buildApp } from '../app';
import { CHILDREN, id, USERS } from './fixtures';
import {
  createQrCode,
  decideJoinRequest,
  findCoachInvite,
  liveQrCode,
  redeemQrCode,
  revokeQrCode,
} from './team';
import { MockWorld } from './world';

const TEAM = id(201); // Tufts women's soccer: one coach, four athletes, two parents, a teen
const OTHER_TEAM = id(202); // invited, no coach yet
const KAI_REQUEST = id(1101);
const LIVE_CODE = id(1201);
const REVOKED_CODE = id(1202);
const MATEO = CHILDREN[0]!; // Lisa's son

let close: (() => Promise<void>) | undefined;
afterEach(() => close?.());

/** A fresh mock API, signed in as `role`'s fixture user. */
const signIn = async (role: Role) => {
  const app = await buildApp({ sessionSecret: 'x'.repeat(32), corsOrigins: [], mock: true });
  close = () => app.close();
  const res = await app.inject({ method: 'POST', url: '/auth/dev-sign-in', payload: { role } });
  expect(res.statusCode).toBe(200);
  const cookie = res.cookies[0]!;
  const call = async (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    payload?: object,
  ) => {
    const r = await app.inject({ method, url, payload, cookies: { [cookie.name]: cookie.value } });
    return { status: r.statusCode, body: r.json(), text: r.body };
  };
  return { call };
};

const userIds = (members: { user: { id: string } }[]) => members.map((m) => m.user.id);

describe('team: join approvals', () => {
  it('shows the coach their team’s pending requests', async () => {
    const { call } = await signIn('coach');
    const res = await call('GET', `/teams/${TEAM}/join-requests`);
    expect(res.status).toBe(200);
    expect(res.body.map((r: { id: string }) => r.id)).toEqual([KAI_REQUEST]);
  });

  it('approving adds the requester to the roster, once', async () => {
    const { call } = await signIn('coach');
    const res = await call('POST', `/join-requests/${KAI_REQUEST}/decision`, {
      decision: 'approve',
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
    const roster = await call('GET', `/teams/${TEAM}/members`);
    expect(userIds(roster.body.athletes)).toContain(USERS.kai.id);
    expect(roster.body.pendingRequestCount).toBe(0);
    const again = await call('POST', `/join-requests/${KAI_REQUEST}/decision`, {
      decision: 'decline',
    });
    expect(again.status).toBe(409);
  });

  it('declining leaves the requester off the team', async () => {
    const { call } = await signIn('coach');
    await call('POST', `/join-requests/${KAI_REQUEST}/decision`, { decision: 'decline' });
    const roster = await call('GET', `/teams/${TEAM}/members`);
    expect(userIds(roster.body.athletes)).not.toContain(USERS.kai.id);
  });

  it('only the team’s coaches and staff can see or decide requests', async () => {
    for (const role of ['athlete', 'parent', 'teen'] as const) {
      const { call } = await signIn(role);
      expect((await call('GET', `/teams/${TEAM}/join-requests`)).status, role).toBe(403);
      const res = await call('POST', `/join-requests/${KAI_REQUEST}/decision`, {
        decision: 'approve',
      });
      expect(res.status, role).toBe(403);
      await close?.();
    }
    const { call } = await signIn('recruiter');
    expect((await call('GET', `/teams/${TEAM}/join-requests`)).status).toBe(404);
    const res = await call('POST', `/join-requests/${KAI_REQUEST}/decision`, {
      decision: 'approve',
    });
    expect(res.status).toBe(403);
  });

  it('staff can decide', async () => {
    const { call } = await signIn('staff');
    const res = await call('POST', `/join-requests/${KAI_REQUEST}/decision`, {
      decision: 'approve',
    });
    expect(res.status).toBe(200);
  });

  it('a coach can’t decide for a team they don’t coach', () => {
    const world = new MockWorld({ identitySearch: true, medicalCommunities: true });
    world.joinRequests.push({
      ...world.joinRequests[0]!,
      id: id(1199),
      teamId: OTHER_TEAM,
    });
    const coach = world.user(USERS.coach.id)!;
    // What the route calls; Dana coaches soccer, not lacrosse.
    const result = decideJoinRequest(world, coach, id(1199), 'approve');
    expect(result).toEqual({ error: 'Only this team’s coaches can decide', status: 403 });
    expect(world.teamIdsOf(USERS.kai.id)).not.toContain(OTHER_TEAM);
  });
});

describe('team: roster', () => {
  it('groups the team, with each parent’s children', async () => {
    const { call } = await signIn('coach');
    const res = await call('GET', `/teams/${TEAM}/members`);
    expect(res.status).toBe(200);
    expect(userIds(res.body.coaches)).toEqual([USERS.coach.id]);
    expect(userIds(res.body.athletes).sort()).toEqual(
      [USERS.jordan.id, USERS.sam.id, USERS.riley.id, USERS.ava.id].sort(),
    );
    expect(userIds(res.body.teens)).toEqual([USERS.noah.id]);
    const lisa = res.body.parents.find(
      (p: { user: { id: string } }) => p.user.id === USERS.lisa.id,
    );
    expect(lisa.children).toEqual([{ id: MATEO.id, firstName: 'Mateo' }]);
    expect(res.body.canManage).toBe(true);
    expect(res.body.pendingRequestCount).toBe(1);
  });

  it('gives the team’s coaches families’ contact details', async () => {
    const { call } = await signIn('coach');
    const res = await call('GET', `/teams/${TEAM}/members`);
    const lisa = res.body.parents.find(
      (p: { user: { id: string } }) => p.user.id === USERS.lisa.id,
    );
    expect(lisa.contact.email).toBe(USERS.lisa.email);
    expect(lisa.contact.phone).toBeTruthy();
  });

  it('never gives a teen any contact details', async () => {
    const { call } = await signIn('teen');
    const res = await call('GET', `/teams/${TEAM}/members`);
    expect(res.status).toBe(200);
    expect(res.body.canManage).toBe(false);
    expect(res.body.pendingRequestCount).toBeNull();
    for (const p of res.body.parents) expect(p.contact).toBeNull();
    expect(res.text).not.toContain('@');
    expect(res.text).not.toContain('555');
  });

  it('gives athletes, parents and staff no family contacts either', async () => {
    for (const role of ['athlete', 'parent', 'staff'] as const) {
      const { call } = await signIn(role);
      const res = await call('GET', `/teams/${TEAM}/members`);
      expect(res.status, role).toBe(200);
      expect(res.text, role).not.toContain('@');
      await close?.();
    }
  });

  it('hides the roster from anyone off the team', async () => {
    for (const role of ['recruiter', 'alumni_athlete'] as const) {
      const { call } = await signIn(role);
      expect((await call('GET', `/teams/${TEAM}/members`)).status, role).toBe(404);
      await close?.();
    }
  });
});

describe('team: removing members', () => {
  it('removing a parent also takes their under-13 child off the team', async () => {
    const { call } = await signIn('coach');
    const res = await call('DELETE', `/teams/${TEAM}/members/${USERS.lisa.id}`);
    expect(res.status).toBe(200);
    expect(res.body.removedChildren).toEqual([{ id: MATEO.id, firstName: 'Mateo' }]);
    expect(userIds(res.body.roster.parents)).not.toContain(USERS.lisa.id);
    // Mark's child stays with Mark.
    const mark = res.body.roster.parents.find(
      (p: { user: { id: string } }) => p.user.id === USERS.mark.id,
    );
    expect(mark.children.map((c: { firstName: string }) => c.firstName)).toEqual(['Ella']);
  });

  it('a team always keeps one coach', async () => {
    const { call } = await signIn('coach');
    const res = await call('DELETE', `/teams/${TEAM}/members/${USERS.coach.id}`);
    expect(res.status).toBe(409);
  });

  it('only coaches and staff remove members', async () => {
    const { call } = await signIn('athlete');
    const res = await call('DELETE', `/teams/${TEAM}/members/${USERS.sam.id}`);
    expect(res.status).toBe(403);
  });
});

describe('team: QR codes', () => {
  it('lists, creates with a label and short code, and revokes', async () => {
    const { call } = await signIn('coach');
    const list = await call('GET', `/teams/${TEAM}/qr-codes`);
    expect(list.status).toBe(200);
    expect(list.body.map((c: { id: string }) => c.id).sort()).toEqual([LIVE_CODE, REVOKED_CODE]);

    const created = await call('POST', `/teams/${TEAM}/qr-codes`, {
      lifetime: 'tonight',
      label: 'Parents’ night',
    });
    expect(created.status).toBe(201);
    expect(created.body.label).toBe('Parents’ night');
    expect(created.body.shortCode).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    expect(created.body.revokedAt).toBeNull();

    const revoked = await call('POST', `/qr-codes/${created.body.id}/revoke`);
    expect(revoked.status).toBe(200);
    expect(revoked.body.revokedAt).not.toBeNull();
  });

  it('lists who joined through a code', async () => {
    const { call } = await signIn('coach');
    const res = await call('GET', `/qr-codes/${LIVE_CODE}/joins`);
    expect(res.status).toBe(200);
    expect(res.body.map((j: { user: { id: string } }) => j.user.id)).toContain(USERS.jordan.id);
  });

  it('keeps codes and tokens from everyone but the team’s coaches', async () => {
    for (const role of ['athlete', 'parent', 'teen', 'staff'] as const) {
      const { call } = await signIn(role);
      expect((await call('GET', `/teams/${TEAM}/qr-codes`)).status, role).toBe(403);
      expect((await call('GET', `/qr-codes/${LIVE_CODE}/joins`)).status, role).toBe(403);
      await close?.();
    }
  });

  it('a revoked or expired code can’t be used to join', () => {
    const world = new MockWorld({ identitySearch: true, medicalCommunities: true });
    const coach = world.user(USERS.coach.id)!;
    const leo = world.user(USERS.leo.id)!;
    const revoked = world.qrCodes.find((c) => c.id === REVOKED_CODE)!;
    expect(liveQrCode(world, revoked.token)).toBeNull();
    expect(redeemQrCode(world, leo, revoked.shortCode)).toMatch(/expired or been turned off/);
    expect(world.teamIdsOf(leo.id)).not.toContain(TEAM);

    const code = createQrCode(world, coach, TEAM, 'tonight', undefined);
    const later = Date.now() + 7 * 3_600_000;
    expect(redeemQrCode(world, leo, code.token, later)).toMatch(/expired/);

    revokeQrCode(code);
    expect(redeemQrCode(world, leo, code.token)).toMatch(/turned off/);
    expect(world.teamIdsOf(leo.id)).not.toContain(TEAM);
  });

  it('a live code joins the team and lands on the code’s join list', () => {
    const world = new MockWorld({ identitySearch: true, medicalCommunities: true });
    const leo = world.user(USERS.leo.id)!;
    const live = world.qrCodes.find((c) => c.id === LIVE_CODE)!;
    // Typed by hand, in lower case with a dash.
    const typed = `${live.shortCode.slice(0, 4)}-${live.shortCode.slice(4)}`.toLowerCase();
    expect(redeemQrCode(world, leo, typed)).toBeNull();
    expect(world.teamIdsOf(leo.id)).toContain(TEAM);
    expect(live.joins.map((j) => j.userId)).toContain(leo.id);
  });

  it('recruiters and alumni can’t join with a code', () => {
    const world = new MockWorld({ identitySearch: true, medicalCommunities: true });
    const live = world.qrCodes.find((c) => c.id === LIVE_CODE)!;
    for (const u of [USERS.elena, USERS.priya]) {
      expect(redeemQrCode(world, world.user(u.id)!, live.token)).not.toBeNull();
      expect(world.teamIdsOf(u.id)).not.toContain(TEAM);
    }
  });
});

describe('team: coach invites and edits', () => {
  it('a coach invites another coach and sees the invite waiting', async () => {
    const { call } = await signIn('coach');
    const res = await call('POST', `/teams/${TEAM}/coach-invites`, {
      email: 'Assistant.Coach@Tufts.edu',
    });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('assistant.coach@tufts.edu');
    expect(res.text).not.toContain('token');
    const list = await call('GET', `/teams/${TEAM}/coach-invites`);
    expect(list.body.map((i: { id: string }) => i.id)).toEqual([res.body.id]);
    const dupe = await call('POST', `/teams/${TEAM}/coach-invites`, {
      email: 'assistant.coach@tufts.edu',
    });
    expect(dupe.status).toBe(409);
    const revoked = await call('POST', `/coach-invites/${res.body.id}/revoke`);
    expect(revoked.body.revokedAt).not.toBeNull();
    expect((await call('GET', `/teams/${TEAM}/coach-invites`)).body).toEqual([]);
  });

  it('only coaches and staff invite coaches', async () => {
    const { call } = await signIn('athlete');
    const res = await call('POST', `/teams/${TEAM}/coach-invites`, { email: 'x@tufts.edu' });
    expect(res.status).toBe(403);
  });

  it('an invite token is findable until it is revoked', () => {
    const world = new MockWorld({ identitySearch: true, medicalCommunities: true });
    world.coachInvites.push({
      id: id(1301),
      teamId: TEAM,
      email: 'a@tufts.edu',
      token: 'invite-token-0000000001',
      invitedById: USERS.coach.id,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      acceptedAt: null,
      revokedAt: null,
      createdAt: new Date().toISOString(),
    });
    expect(findCoachInvite(world, 'invite-token-0000000001')?.id).toBe(id(1301));
    world.coachInvites[0]!.revokedAt = new Date().toISOString();
    expect(findCoachInvite(world, 'invite-token-0000000001')).toBeNull();
  });

  it('a coach edits the team’s name, colour and about', async () => {
    const { call } = await signIn('coach');
    const res = await call('PATCH', `/teams/${TEAM}`, {
      name: 'Jumbos Soccer',
      color: '#5A2D82',
      about: null,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Jumbos Soccer', color: '#5A2D82', about: null });
    const roster = await call('GET', `/teams/${TEAM}/members`);
    expect(roster.body.team.name).toBe('Jumbos Soccer');
  });

  it('only coaches and staff edit the team', async () => {
    const { call } = await signIn('parent');
    expect((await call('PATCH', `/teams/${TEAM}`, { name: 'Ours' })).status).toBe(403);
  });
});
