import { z } from 'zod';
import {
  College,
  CreateJoinRequest,
  DecideJoinRequest,
  FindTeamsQuery,
  IdParams,
  JoinRequest,
  TeamSummary,
} from '@team-impact/contracts';
import type { ZodApp } from '../../zod';
import { COLLEGES, summaryOf, TEAMS } from '../fixtures';
import { decideJoinRequest, isTeamLive, pendingChildren } from '../signup';
import type { MockWorld } from '../world';
import { httpError, type Guards } from './context';

/** Joining a team: colleges, teams, join requests. */
export const registerJoinRoutes = (
  app: ZodApp,
  world: MockWorld,
  { viewer, requireRole }: Guards,
) => {
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
          isTeamLive(world, t.id) &&
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
      const team = TEAMS.find((t) => t.id === body.teamId && isTeamLive(world, t.id));
      if (!team) throw httpError(404, 'No such team');
      // A parent already on the team can still ask the coach to add their children.
      const addingChildren = body.role === 'parent' && (body.children?.length ?? 0) > 0;
      if (world.teamIdsOf(u.id).includes(team.id) && !addingChildren) {
        throw httpError(409, 'Already on this team');
      }
      const pending = world.joinRequests.some(
        (r) => r.requester.id === u.id && r.teamId === team.id && r.status === 'pending',
      );
      if (pending) throw httpError(409, 'You already asked to join this team');
      const base = {
        id: world.newId(),
        teamId: team.id,
        requester: summaryOf(u),
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
        decidedAt: null,
      };
      // Children are kept as first name, last initial and age: never a birth date or account.
      const created: JoinRequest =
        body.role === 'parent'
          ? {
              ...base,
              role: 'parent',
              relationship: body.relationship,
              children: pendingChildren(body.children),
            }
          : body.role === 'athlete'
            ? { ...base, role: 'athlete', classYear: body.classYear }
            : { ...base, role: 'teen' };
      world.joinRequests.push(created);
      return reply.status(201).send(created);
    },
  );

  app.post(
    '/join-requests/:id/decision',
    { schema: { params: IdParams, body: DecideJoinRequest, response: { 200: JoinRequest } } },
    async (request) => {
      const u = requireRole(request, 'coach', 'staff');
      const found = world.joinRequests.find((r) => r.id === request.params.id);
      const mayDecide =
        found && (u.role === 'staff' || world.teamIdsOf(u.id).includes(found.teamId));
      if (!found || !mayDecide) throw httpError(404, 'No such request');
      if (found.status !== 'pending') throw httpError(409, 'This request was already decided');
      decideJoinRequest(world, found, request.body.decision);
      return found;
    },
  );
};
