import { z } from 'zod';
import {
  Company,
  IdentitySearchLogEntry,
  IdParams,
  ModerationTicket,
  ResolveTicketRequest,
  SetCommunityOfficialRequest,
  StaffCommunity,
  Team,
} from '@team-impact/contracts';
import type { ZodApp } from '../../zod';
import { applyResolution } from '../activity';
import { COMPANIES, TEAMS } from '../fixtures';
import type { MockWorld } from '../world';
import { httpError, type Guards } from './context';

/** Staff tools: teams, companies, moderation, communities. */
export const registerStaffRoutes = (app: ZodApp, world: MockWorld, { requireRole }: Guards) => {
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
      // Remove takes the item down; keep approves anything still held for review.
      applyResolution(world, ticket.target, ticket.resolution);
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
      if (request.body.official && c.private) {
        throw httpError(400, 'Private communities can’t be official');
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
