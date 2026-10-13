import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  AthleteSearchQuery,
  CalendarEvent,
  CardFace,
  CardWithContact,
  College,
  Community,
  Company,
  CreateJoinRequest,
  DevSignInRequest,
  FindTeamsQuery,
  IdentitySearchLogEntry,
  IdParams,
  JoinRequest,
  Me,
  ModerationTicket,
  page,
  PageQuery,
  Post,
  RecruiterList,
  RecruiterListDetail,
  ResolveTicketRequest,
  type Role,
  SetCommunityOfficialRequest,
  StaffCommunity,
  Team,
  TeamSummary,
} from '@team-impact/contracts';
import type { ZodApp } from '../zod';
import { COLLEGES, COMPANIES, NEWCOMERS, SIGN_IN_AS, summaryOf, TEAMS } from './fixtures';
import type { MockUser, MockWorld } from './world';

const SESSION_COOKIE = 'ti_session';

/** Fastify's error handler (src/zod.ts) turns `statusCode` into the shared error shape. */
const httpError = (statusCode: number, message: string) =>
  Object.assign(new Error(message), { statusCode });

/** Cursor pagination over an in-memory array: the cursor is the next offset. */
const paginate = <T>(items: T[], { cursor, limit = 20 }: { cursor?: string; limit?: number }) => {
  const start = Number(cursor ?? 0);
  const next = start + limit;
  return {
    items: items.slice(start, next),
    nextCursor: next < items.length ? String(next) : null,
  };
};

/**
 * Every route the clients need for the shells, on fixture data (MOCK_API=1). Paths and shapes are
 * the ones the real API will serve, so swapping mocks for the database changes no client code.
 */
export const registerMockRoutes = (app: ZodApp, world: MockWorld) => {
  const viewer = (request: FastifyRequest): MockUser => {
    const raw = request.cookies[SESSION_COOKIE];
    const unsigned = raw ? request.unsignCookie(raw) : null;
    const u = unsigned?.valid && unsigned.value ? world.user(unsigned.value) : undefined;
    if (!u) throw httpError(401, 'Sign in first');
    return u;
  };

  const requireRole = (request: FastifyRequest, ...roles: Role[]) => {
    const u = viewer(request);
    if (!roles.includes(u.role)) throw httpError(403, 'Not available for your role');
    return u;
  };

  // Session --------------------------------------------------------------------------------------

  app.post(
    '/auth/dev-sign-in',
    { schema: { body: DevSignInRequest, response: { 200: Me } } },
    async (request, reply) => {
      const { role, newcomer } = request.body;
      const u = newcomer ? NEWCOMERS[role] : SIGN_IN_AS[role];
      if (!u) throw httpError(400, 'Only athletes, parents and teens can join as newcomers');
      reply.setCookie(SESSION_COOKIE, u.id, {
        signed: true,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });
      return world.me(u);
    },
  );

  app.post('/auth/sign-out', async (_request, reply: FastifyReply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.status(204).send();
  });

  app.get('/me', { schema: { response: { 200: Me } } }, async (request) =>
    world.me(viewer(request)),
  );

  // Communities, feed, events --------------------------------------------------------------------

  app.get(
    '/communities',
    { schema: { response: { 200: z.array(Community) } } },
    async (request) => {
      const u = viewer(request);
      return world.communities
        .filter((c) => world.canSeeCommunity(c, u))
        .map((c) => world.community(c, u));
    },
  );

  app.get(
    '/communities/:id',
    { schema: { params: IdParams, response: { 200: Community } } },
    async (request) => {
      const u = viewer(request);
      const c = world.communities.find((x) => x.id === request.params.id);
      if (!c || !world.canSeeCommunity(c, u)) throw httpError(404, 'No such community');
      return world.community(c, u);
    },
  );

  app.get(
    '/feed',
    { schema: { querystring: PageQuery, response: { 200: page(Post) } } },
    async (request) => paginate(world.feed(viewer(request)), request.query),
  );

  app.get('/events', { schema: { response: { 200: z.array(CalendarEvent) } } }, async (request) =>
    world.eventsFor(viewer(request)),
  );

  // Join flow ------------------------------------------------------------------------------------

  app.get('/colleges', { schema: { response: { 200: z.array(College) } } }, async (request) => {
    viewer(request);
    return COLLEGES;
  });

  app.get(
    '/teams',
    { schema: { querystring: FindTeamsQuery, response: { 200: z.array(TeamSummary) } } },
    async (request) => {
      viewer(request);
      const { collegeId, sport } = request.query;
      return TEAMS.filter(
        (t) =>
          t.status === 'live' &&
          t.college.id === collegeId &&
          (!sport || t.sport.toLowerCase() === sport.toLowerCase()),
      ).map((t) => world.teamSummary(t.id));
    },
  );

  app.post(
    '/join-requests',
    { schema: { body: CreateJoinRequest, response: { 201: JoinRequest } } },
    async (request, reply) => {
      const u = requireRole(request, 'athlete', 'parent', 'teen');
      const body = request.body;
      if (body.role !== u.role) throw httpError(400, 'Request as the role on your account');
      const team = TEAMS.find((t) => t.id === body.teamId && t.status === 'live');
      if (!team) throw httpError(404, 'No such team');
      if (world.teamIdsOf(u.id).includes(team.id)) throw httpError(409, 'Already on this team');
      const pending = world.joinRequests.some(
        (r) => r.requester.id === u.id && r.teamId === team.id && r.status === 'pending',
      );
      if (pending) throw httpError(409, 'You already asked to join this team');
      const created: JoinRequest = {
        ...body,
        id: world.newId(),
        requester: summaryOf(u),
        status: 'pending',
        createdAt: new Date().toISOString(),
        decidedAt: null,
      };
      world.joinRequests.push(created);
      return reply.status(201).send(created);
    },
  );

  // Recruiters -----------------------------------------------------------------------------------

  app.get(
    '/search/athletes',
    { schema: { querystring: AthleteSearchQuery, response: { 200: page(CardFace) } } },
    async (request) => {
      const u = requireRole(request, 'recruiter');
      const q = request.query;
      let cards = world.cards.filter(world.recruiterCanSee);

      if (q.communityId) {
        if (!world.flags.identitySearch) throw httpError(400, 'The community filter is off');
        const c = world.communities.find((x) => x.id === q.communityId);
        // Only official interest communities are filters; team and medical ones never are.
        if (!c || c.kind !== 'interest' || !c.official || c.moderation !== 'approved') {
          throw httpError(400, 'Only official communities can be used as filters');
        }
        const findable = new Set(
          c.members.filter((m) => m.recruiterSearchOptIn).map((m) => m.userId),
        );
        cards = cards.filter((card) => findable.has(card.face.athleteId));
        const company = COMPANIES.find((co) => co.id === u.companyId)!;
        world.identitySearches.push({
          id: world.newId(),
          recruiter: summaryOf(u),
          company: { id: company.id, name: company.name },
          community: { id: c.id, name: c.name },
          searchedAt: new Date().toISOString(),
        });
      }

      const has = (value: string | null | undefined, wanted?: string) =>
        !wanted || (value ?? '').toLowerCase().includes(wanted.toLowerCase());
      const faces = cards
        .map(world.cardFace)
        .filter(
          (f) =>
            (!q.region || f.region === q.region) &&
            has(f.city, q.city) &&
            has(f.team?.sport, q.sport) &&
            has(f.major, q.major) &&
            (!q.classYear || f.classYear === q.classYear) &&
            (!q.division || f.team?.division === q.division) &&
            has(f.experience, q.experience),
        );
      return paginate(faces, q);
    },
  );

  app.get(
    '/cards/:id',
    { schema: { params: IdParams, response: { 200: CardWithContact } } },
    async (request) => {
      const card = world.cardFor(request.params.id, viewer(request));
      if (!card) throw httpError(404, 'No such card');
      return card;
    },
  );

  app.get('/lists', { schema: { response: { 200: z.array(RecruiterList) } } }, async (request) =>
    world.listsFor(requireRole(request, 'recruiter')).map(world.list),
  );

  app.get(
    '/lists/:id',
    { schema: { params: IdParams, response: { 200: RecruiterListDetail } } },
    async (request) => {
      const u = requireRole(request, 'recruiter');
      const list = world.listsFor(u).find((l) => l.id === request.params.id);
      if (!list) throw httpError(404, 'No such list');
      return world.listDetail(list, u);
    },
  );

  // Staff ----------------------------------------------------------------------------------------

  app.get('/staff/teams', { schema: { response: { 200: z.array(Team) } } }, async (request) => {
    requireRole(request, 'staff');
    return TEAMS.map((t) => ({
      ...t,
      memberCount: world.teamMembers.filter((m) => m.teamId === t.id).length,
    }));
  });

  app.get(
    '/staff/companies',
    { schema: { response: { 200: z.array(Company) } } },
    async (request) => {
      requireRole(request, 'staff');
      return COMPANIES.map((c) => ({
        ...c,
        recruiterCount: world.users.filter((u) => u.companyId === c.id).length,
      }));
    },
  );

  app.get(
    '/staff/moderation/tickets',
    { schema: { response: { 200: z.array(ModerationTicket) } } },
    async (request) => {
      requireRole(request, 'staff');
      return [...world.tickets].sort(
        (a, b) =>
          Number(a.status === 'resolved') - Number(b.status === 'resolved') ||
          b.createdAt.localeCompare(a.createdAt),
      );
    },
  );

  app.post(
    '/staff/moderation/tickets/:id/resolve',
    {
      schema: { params: IdParams, body: ResolveTicketRequest, response: { 200: ModerationTicket } },
    },
    async (request) => {
      requireRole(request, 'staff');
      const ticket = world.tickets.find((t) => t.id === request.params.id);
      if (!ticket) throw httpError(404, 'No such ticket');
      ticket.status = 'resolved';
      ticket.resolution = request.body.resolution;
      if (ticket.resolution === 'remove') {
        const { kind, id } = ticket.target;
        const item =
          kind === 'post'
            ? world.posts.find((p) => p.id === id)
            : kind === 'event'
              ? world.events.find((e) => e.id === id)
              : kind === 'community'
                ? world.communities.find((c) => c.id === id)
                : undefined;
        if (item) item.moderation = 'removed';
      }
      return ticket;
    },
  );

  app.get(
    '/staff/communities',
    { schema: { response: { 200: z.array(StaffCommunity) } } },
    async (request) => {
      const u = requireRole(request, 'staff');
      return world.communities
        .filter((c) => world.canSeeCommunity(c, u))
        .map((c) => world.staffCommunity(c, u));
    },
  );

  app.put(
    '/staff/communities/:id/official',
    {
      schema: {
        params: IdParams,
        body: SetCommunityOfficialRequest,
        response: { 200: StaffCommunity },
      },
    },
    async (request) => {
      const u = requireRole(request, 'staff');
      const c = world.communities.find((x) => x.id === request.params.id);
      if (!c || !world.canSeeCommunity(c, u)) throw httpError(404, 'No such community');
      if (c.kind !== 'interest') {
        throw httpError(400, 'Only interest communities can be official');
      }
      if (request.body.official && c.moderation !== 'approved') {
        throw httpError(400, 'Approve the community before marking it official');
      }
      c.official = request.body.official;
      return world.staffCommunity(c, u);
    },
  );

  app.get(
    '/staff/identity-searches',
    { schema: { response: { 200: z.array(IdentitySearchLogEntry) } } },
    async (request) => {
      requireRole(request, 'staff');
      return [...world.identitySearches].reverse();
    },
  );
};
