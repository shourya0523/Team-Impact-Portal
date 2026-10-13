import { z } from 'zod';
import {
  College,
  CreateJoinRequest,
  FindTeamsQuery,
  JoinRequest,
  TeamSummary,
} from '@team-impact/contracts';
import type { ZodApp } from '../../zod';
import { COLLEGES, summaryOf } from '../fixtures';
import { pendingChildren } from '../signup';
import { isTeamLive } from '../team';
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
      return world.teams
        .filter(
          (t) =>
            isTeamLive(world, t.id) &&
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
      const team = world.teams.find((t) => t.id === body.teamId && isTeamLive(world, t.id));
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
  // Coaches decide in routes/team.ts (`POST /join-requests/:id/decision`).
};
