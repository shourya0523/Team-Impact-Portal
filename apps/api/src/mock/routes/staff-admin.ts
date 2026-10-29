import { z } from 'zod';
import {
  CoachInvite,
  College,
  Company,
  CreateAnnouncementRequest,
  CreateCompanyRequest,
  CreateTeamRequest,
  IdParams,
  InviteCoachRequest,
  MergeCollegeRequest,
  MergeCommunityRequest,
  Post,
  SaveCollegeRequest,
  StaffCommunity,
  StaffUpdateTeamRequest,
  Team,
  TeamCoaches,
  type TrackedEvent,
} from '@team-impact/contracts';
import type { ZodApp } from '../../zod';
import { announce } from '../activity';
import { summaryOf } from '../fixtures';
import { toPost } from '../safety';
import { isSuspended } from '../staff-tools';
import {
  archiveTeam,
  changedTeamFields,
  coachInviteView,
  createCoachInvite,
  resendCoachInvite,
  renameTeamCommunity,
  restoreTeam,
  revokeCoachInvite,
  UNREADABLE_COLOR_MESSAGE,
  unreadableTeamColor,
} from '../team';
import type { MockUser, MockWorld } from '../world';
import { httpError, type Guards } from './context';

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Staff tools that write (PRD §9, S2, S3, S6, S7, S8, S10, S1): colleges, teams and coach invites,
 * companies and suspension, merging and removing communities, and Team Impact announcements.
 * Every route is staff only.
 */
export const registerStaffAdminRoutes = (
  app: ZodApp,
  world: MockWorld,
  { requireRole }: Guards,
) => {
  const staffOnly = (request: Parameters<Guards['viewer']>[0]) => requireRole(request, 'staff');

  // Colleges (S6) --------------------------------------------------------------------------------

  const findCollege = (id: string) => {
    const c = world.colleges.find((x) => x.id === id);
    if (!c) throw httpError(404, 'No such college');
    return c;
  };
  const nameTaken = (name: string, except?: string) =>
    world.colleges.some((c) => c.id !== except && same(c.name, name));

  app.get('/staff/colleges', { schema: { response: { 200: z.array(College) } } }, async (req) => {
    staffOnly(req);
    return [...world.colleges].sort((a, b) => a.name.localeCompare(b.name));
  });

  app.post(
    '/staff/colleges',
    { schema: { body: SaveCollegeRequest, response: { 201: College } } },
    async (request, reply) => {
      staffOnly(request);
      if (nameTaken(request.body.name)) throw httpError(409, 'That college is already listed');
      const college = { id: world.newId(), name: request.body.name };
      world.colleges.push(college);
      return reply.status(201).send(college);
    },
  );

  app.put(
    '/staff/colleges/:id',
    { schema: { params: IdParams, body: SaveCollegeRequest, response: { 200: College } } },
    async (request) => {
      staffOnly(request);
      const college = findCollege(request.params.id);
      if (nameTaken(request.body.name, college.id)) {
        throw httpError(409, 'That college is already listed');
      }
      college.name = request.body.name;
      for (const t of world.teams) {
        if (t.college.id !== college.id) continue;
        t.college = { ...college };
        renameTeamCommunity(world, t);
      }
      return college;
    },
  );

  app.post(
    '/staff/colleges/:id/merge',
    { schema: { params: IdParams, body: MergeCollegeRequest, response: { 200: College } } },
    async (request) => {
      staffOnly(request);
      const from = findCollege(request.params.id);
      const into = findCollege(request.body.intoCollegeId);
      if (from.id === into.id) throw httpError(400, 'Pick a different college to merge into');
      const clash = world.teams.find(
        (t) =>
          t.college.id === from.id &&
          world.teams.some(
            (o) => o.college.id === into.id && same(o.sport, t.sport) && o.gender === t.gender,
          ),
      );
      if (clash) throw httpError(409, `${into.name} already has a ${clash.name} team`);
      for (const t of world.teams) {
        if (t.college.id !== from.id) continue;
        t.college = { ...into };
        renameTeamCommunity(world, t);
      }
      world.colleges.splice(world.colleges.indexOf(from), 1);
      return into;
    },
  );

  // Teams (S2, S7) -------------------------------------------------------------------------------

  const teamOut = (t: MockWorld['teams'][number]) => ({
    ...t,
    memberCount: world.teamMembers.filter((m) => m.teamId === t.id).length,
  });
  const findTeam = (id: string) => {
    const t = world.teams.find((x) => x.id === id);
    if (!t) throw httpError(404, 'No such team');
    return t;
  };
  /** One team per college, sport and gender (PRD §3). */
  const duplicateTeam = (collegeId: string, sport: string, gender: string, except?: string) =>
    world.teams.some(
      (t) =>
        t.id !== except &&
        t.college.id === collegeId &&
        same(t.sport, sport) &&
        t.gender === gender,
    );
  const coachesOf = (teamId: string) =>
    world.teamMembers.filter((m) => m.teamId === teamId && world.user(m.userId)?.role === 'coach');

  /**
   * Coach invites share the team area's store (`../team.ts`), so `/invites/:token` accepts the ones
   * staff send too; the first coach accepting makes an `invited` team live.
   */
  const invite = (teamId: string, email: string, by: MockUser) => {
    const result = createCoachInvite(world, by, teamId, email);
    if ('error' in result) throw httpError(result.status, result.error);
    return coachInviteView(world, result.invite);
  };

  app.post(
    '/staff/teams',
    { schema: { body: CreateTeamRequest, response: { 201: Team } } },
    async (request, reply) => {
      const u = staffOnly(request);
      const b = request.body;
      const college = findCollege(b.collegeId);
      if (duplicateTeam(college.id, b.sport, b.gender)) {
        throw httpError(409, `${college.name} already has a ${b.gender}'s ${b.sport} team`);
      }
      if (unreadableTeamColor(b.color)) throw httpError(400, UNREADABLE_COLOR_MESSAGE);
      const now = new Date().toISOString();
      const team = {
        id: world.newId(),
        name: b.name,
        college: { ...college },
        sport: b.sport,
        gender: b.gender,
        division: b.division,
        // Stored upper case, so the same colour never looks like an edit.
        color: b.color?.toUpperCase() ?? null,
        logoUrl: null,
        about: null,
        // Waiting on its first coach.
        status: 'invited' as const,
        createdAt: now,
      };
      world.teams.push(team);
      // The team's private community comes with it (PRD §5).
      world.communities.push({
        id: world.newId(),
        kind: 'team',
        teamId: team.id,
        name: `${college.name} ${team.name}`,
        about: 'The team, its families and coaches.',
        moderation: 'approved',
        createdAt: now,
        members: [],
      });
      const firstInvite = invite(team.id, b.firstCoachEmail, u);
      world.track(u.id, [
        { name: 'team.created', properties: { teamId: team.id } },
        { name: 'coach.invited', properties: { teamId: team.id, inviteId: firstInvite.id } },
      ]);
      return reply.status(201).send(teamOut(team));
    },
  );

  app.patch(
    '/staff/teams/:id',
    { schema: { params: IdParams, body: StaffUpdateTeamRequest, response: { 200: Team } } },
    async (request) => {
      const u = staffOnly(request);
      const team = findTeam(request.params.id);
      const { archived, collegeId, ...b } = request.body;
      const college = collegeId ? findCollege(collegeId) : team.college;
      const sport = b.sport ?? team.sport;
      const gender = b.gender ?? team.gender;
      if (duplicateTeam(college.id, sport, gender, team.id)) {
        throw httpError(409, `${college.name} already has a ${gender}'s ${sport} team`);
      }
      if (unreadableTeamColor(b.color)) throw httpError(400, UNREADABLE_COLOR_MESSAGE);
      const fields = changedTeamFields(team, request.body);
      Object.assign(team, {
        ...(b.name !== undefined && { name: b.name }),
        ...(b.color !== undefined && { color: b.color?.toUpperCase() ?? null }),
        ...(b.about !== undefined && { about: b.about }),
        ...(b.division !== undefined && { division: b.division }),
        college: { ...college },
        sport,
        gender,
      });
      if (fields.includes('name') || fields.includes('collegeId')) renameTeamCommunity(world, team);
      const events: TrackedEvent[] = [];
      if (fields.length) {
        events.push({ name: 'team.updated', properties: { teamId: team.id, fields } });
      }
      if (archived === true && team.status !== 'archived') {
        events.push({
          name: 'team.archived',
          properties: { teamId: team.id, ...archiveTeam(world, team) },
        });
      }
      if (archived === false && team.status === 'archived') {
        restoreTeam(world, team);
        events.push({ name: 'team.restored', properties: { teamId: team.id } });
      }
      world.track(u.id, events);
      return teamOut(team);
    },
  );

  app.post(
    '/staff/teams/:id/archive',
    { schema: { params: IdParams, response: { 200: Team } } },
    async (request) => {
      const u = staffOnly(request);
      const team = findTeam(request.params.id);
      if (team.status !== 'archived') {
        const closed = archiveTeam(world, team);
        world.track(u.id, { name: 'team.archived', properties: { teamId: team.id, ...closed } });
      }
      return teamOut(team);
    },
  );

  // Coaches and invites (S8) ---------------------------------------------------------------------

  app.get(
    '/staff/teams/:id/coaches',
    { schema: { params: IdParams, response: { 200: TeamCoaches } } },
    async (request) => {
      staffOnly(request);
      const team = findTeam(request.params.id);
      return {
        coaches: coachesOf(team.id).map((m) => ({
          user: summaryOf(world.user(m.userId)!),
          joinedVia: m.joinedVia,
          joinedAt: m.joinedAt,
          suspended: isSuspended(world, m.userId),
        })),
        invites: world.coachInvites
          .filter((i) => i.teamId === team.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((i) => coachInviteView(world, i)),
      };
    },
  );

  app.post(
    '/staff/teams/:id/coach-invites',
    { schema: { params: IdParams, body: InviteCoachRequest, response: { 201: CoachInvite } } },
    async (request, reply) => {
      const u = staffOnly(request);
      const team = findTeam(request.params.id);
      const sent = invite(team.id, request.body.email, u);
      world.track(u.id, {
        name: 'coach.invited',
        properties: { teamId: team.id, inviteId: sent.id },
      });
      return reply.status(201).send(sent);
    },
  );

  app.post(
    '/staff/coach-invites/:id/revoke',
    { schema: { params: IdParams, response: { 200: CoachInvite } } },
    async (request) => {
      const u = staffOnly(request);
      const i = world.coachInvites.find((x) => x.id === request.params.id);
      if (!i) throw httpError(404, 'No such invite');
      const result = revokeCoachInvite(i);
      if ('error' in result) throw httpError(result.status, result.error);
      if (result.changed) {
        world.track(u.id, {
          name: 'coach.invite_revoked',
          properties: { teamId: i.teamId, inviteId: i.id },
        });
      }
      return coachInviteView(world, i);
    },
  );

  /** A fresh link and 7 more days for the same email; the old link stops working. */
  app.post(
    '/staff/coach-invites/:id/resend',
    { schema: { params: IdParams, response: { 201: CoachInvite } } },
    async (request, reply) => {
      const u = staffOnly(request);
      const old = world.coachInvites.find((x) => x.id === request.params.id);
      if (!old) throw httpError(404, 'No such invite');
      const result = resendCoachInvite(world, u, old);
      if ('error' in result) throw httpError(result.status, result.error);
      world.track(u.id, {
        name: 'coach.invited',
        properties: { teamId: old.teamId, inviteId: result.invite.id, replacesInviteId: old.id },
      });
      return reply.status(201).send(coachInviteView(world, result.invite));
    },
  );

  // Companies (S3, R13) --------------------------------------------------------------------------

  const companyOut = (c: MockWorld['companies'][number]) => ({
    ...c,
    recruiterCount: world.users.filter((u) => u.companyId === c.id).length,
  });
  const findCompany = (id: string) => {
    const c = world.companies.find((x) => x.id === id);
    if (!c) throw httpError(404, 'No such company');
    return c;
  };

  app.post(
    '/staff/companies',
    { schema: { body: CreateCompanyRequest, response: { 201: Company } } },
    async (request, reply) => {
      staffOnly(request);
      const { name, domains } = request.body;
      if (world.companies.some((c) => same(c.name, name))) {
        throw httpError(409, 'That company is already onboarded');
      }
      const taken = domains.find((d) => world.companies.some((c) => c.domains.includes(d)));
      if (taken) throw httpError(409, `${taken} already belongs to another company`);
      const company = {
        id: world.newId(),
        name,
        domains,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
      };
      world.companies.push(company);
      return reply.status(201).send(companyOut(company));
    },
  );

  for (const [path, status] of [
    ['suspend', 'suspended'],
    ['restore', 'active'],
  ] as const) {
    app.post(
      `/staff/companies/:id/${path}`,
      { schema: { params: IdParams, response: { 200: Company } } },
      async (request) => {
        staffOnly(request);
        const company = findCompany(request.params.id);
        // Suspended: every recruiter at the company is refused until it's restored. Lists and
        // notes survive (see the session guard).
        company.status = status;
        return companyOut(company);
      },
    );
  }

  // Communities (S10) ----------------------------------------------------------------------------

  const findCommunity = (id: string, staff: MockUser) => {
    const c = world.communities.find((x) => x.id === id);
    if (!c || !world.canSeeCommunity(c, staff)) throw httpError(404, 'No such community');
    return c;
  };

  app.post(
    '/staff/communities/:id/merge',
    {
      schema: { params: IdParams, body: MergeCommunityRequest, response: { 200: StaffCommunity } },
    },
    async (request) => {
      const u = staffOnly(request);
      const from = findCommunity(request.params.id, u);
      const into = findCommunity(request.body.intoId, u);
      if (from.id === into.id) throw httpError(400, 'Pick a different community to merge into');
      if (from.kind !== into.kind) throw httpError(400, 'Only communities of the same kind merge');
      if (from.kind === 'team' || from.kind === 'team_impact' || into.kind === 'team') {
        throw httpError(400, 'Team and Team Impact communities can’t be merged');
      }
      if (from.kind !== 'interest' && from.kind !== 'medical') return world.staffCommunity(into, u);
      if (into.kind !== 'interest' && into.kind !== 'medical') return world.staffCommunity(into, u);
      // Members-only posts can't move somewhere anyone can read them.
      if (from.private && !into.private) {
        throw httpError(400, 'A private community can only merge into another private one');
      }
      for (const m of from.members) {
        if (into.members.some((x) => x.userId === m.userId)) continue;
        // Being findable through a community is its own opt-in; it never carries over.
        into.members.push({ userId: m.userId, joinedAt: m.joinedAt, recruiterSearchOptIn: false });
      }
      for (const r of from.requests) {
        const known =
          into.members.some((x) => x.userId === r.userId) ||
          into.requests.some((x) => x.userId === r.userId);
        if (!known) into.requests.push(r);
      }
      for (const p of world.posts) if (p.communityId === from.id) p.communityId = into.id;
      for (const e of world.events) if (e.communityId === from.id) e.communityId = into.id;
      world.communities.splice(world.communities.indexOf(from), 1);
      return world.staffCommunity(into, u);
    },
  );

  app.delete('/staff/communities/:id', { schema: { params: IdParams } }, async (request, reply) => {
    const u = staffOnly(request);
    const c = findCommunity(request.params.id, u);
    if (c.kind === 'team' || c.kind === 'team_impact') {
      throw httpError(400, 'Team and Team Impact communities can’t be removed');
    }
    c.moderation = 'removed';
    return reply.status(204).send();
  });

  // Announcements (S1) ---------------------------------------------------------------------------

  app.get(
    '/staff/announcements',
    { schema: { response: { 200: z.array(Post) } } },
    async (request) => {
      const u = staffOnly(request);
      return world.posts
        .filter((p) => p.kind === 'announcement')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .flatMap((p) => toPost(world, p, u) ?? []);
    },
  );

  app.post(
    '/staff/announcements',
    { schema: { body: CreateAnnouncementRequest, response: { 201: Post } } },
    async (request, reply) => {
      const u = staffOnly(request);
      const c = findCommunity(request.body.communityId, u);
      if (c.kind !== 'team_impact' && c.kind !== 'team') {
        throw httpError(400, 'Announcements go to Team Impact’s community or a team’s');
      }
      const post = announce(world, u, c, request.body, { push: request.body.sendPush });
      return reply.status(201).send(toPost(world, post, u)!);
    },
  );
};
