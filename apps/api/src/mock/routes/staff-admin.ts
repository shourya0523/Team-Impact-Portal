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
} from '@team-impact/contracts';
import type { ZodApp } from '../../zod';
import type { MockPost } from '../fixtures';
import { toPost } from '../safety';
import { coachInviteView, createCoachInvite, memberView, revokeCoachInvite } from '../team';
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
      for (const t of world.teams) if (t.college.id === college.id) t.college = { ...college };
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
      for (const t of world.teams) if (t.college.id === from.id) t.college = { ...into };
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
      const now = new Date().toISOString();
      const team = {
        id: world.newId(),
        name: b.name,
        college: { ...college },
        sport: b.sport,
        gender: b.gender,
        division: b.division,
        color: b.color ?? null,
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
      invite(team.id, b.firstCoachEmail, u);
      return reply.status(201).send(teamOut(team));
    },
  );

  app.patch(
    '/staff/teams/:id',
    { schema: { params: IdParams, body: StaffUpdateTeamRequest, response: { 200: Team } } },
    async (request) => {
      staffOnly(request);
      const team = findTeam(request.params.id);
      const { archived, collegeId, ...b } = request.body;
      const college = collegeId ? findCollege(collegeId) : team.college;
      const sport = b.sport ?? team.sport;
      const gender = b.gender ?? team.gender;
      if (duplicateTeam(college.id, sport, gender, team.id)) {
        throw httpError(409, `${college.name} already has a ${gender}'s ${sport} team`);
      }
      Object.assign(team, {
        ...(b.name !== undefined && { name: b.name }),
        ...(b.color !== undefined && { color: b.color }),
        ...(b.about !== undefined && { about: b.about }),
        ...(b.division !== undefined && { division: b.division }),
        college: { ...college },
        sport,
        gender,
      });
      if (archived === true) team.status = 'archived';
      // Restoring brings a team back live if it still has a coach, else back to waiting on one.
      if (archived === false && team.status === 'archived') {
        team.status = coachesOf(team.id).length ? 'live' : 'invited';
      }
      return teamOut(team);
    },
  );

  app.post(
    '/staff/teams/:id/archive',
    { schema: { params: IdParams, response: { 200: Team } } },
    async (request) => {
      staffOnly(request);
      const team = findTeam(request.params.id);
      // Out of the join search; its QR codes stop working (S7).
      team.status = 'archived';
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
        coaches: coachesOf(team.id).flatMap((m) => memberView(world, m) ?? []),
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
      if (team.status === 'archived') throw httpError(400, 'Restore the team first');
      return reply.status(201).send(invite(team.id, request.body.email, u));
    },
  );

  app.post(
    '/staff/coach-invites/:id/revoke',
    { schema: { params: IdParams, response: { 200: CoachInvite } } },
    async (request) => {
      const staff = staffOnly(request);
      const i = world.coachInvites.find((x) => x.id === request.params.id);
      if (!i) throw httpError(404, 'No such invite');
      const problem = revokeCoachInvite(world, i, staff);
      if (problem) throw httpError(problem.status, problem.message);
      return coachInviteView(world, i);
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
      const post: MockPost = {
        id: world.newId(),
        kind: 'announcement',
        authorId: u.id,
        communityId: c.id,
        text: request.body.text,
        official: true,
        likeCount: 0,
        commentCount: 0,
        // Staff wrote it, so it skips the review queue.
        moderation: 'approved',
        createdAt: new Date().toISOString(),
      };
      world.posts.push(post);
      return reply.status(201).send(toPost(world, post, u)!);
    },
  );
};
