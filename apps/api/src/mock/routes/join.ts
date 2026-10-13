import { z } from 'zod';
import {
  College,
  CreateJoinRequest,
  FindTeamsQuery,
  JoinRequest,
  TeamSummary,
} from '@team-impact/contracts';
import type { ZodApp } from '../../zod';
import { summaryOf } from '../fixtures';
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
    return world.colleges;
  });

  app.get(
    '/teams',
    { schema: { querystring: FindTeamsQuery, response: { 200: z.array(TeamSummary) } } },
    async (request) => {
      viewer(request);
      const { collegeId, sport } = request.query;
      return world.teams
        .filter(
          (t) =>
            t.status === 'live' &&
            t.college.id === collegeId &&
            (!sport || t.sport.toLowerCase() === sport.toLowerCase()),
        )
        .map((t) => world.teamSummary(t.id));
    },
  );

  app.post(
    '/join-requests',
    { schema: { body: CreateJoinRequest, response: { 201: JoinRequest } } },
    async (request, reply) => {
      const u = requireRole(request, 'athlete', 'parent', 'teen');
      const body = request.body;
      if (body.role !== u.role) throw httpError(400, 'Request as the role on your account');
      const team = world.teams.find((t) => t.id === body.teamId && t.status === 'live');
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
};
