import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  CoachInvite,
  CreateQrCodeRequest,
  DecideJoinRequest,
  IdParams,
  InviteCoachRequest,
  JoinRequest,
  QrCodeJoin,
  RemoveMemberResult,
  Team,
  TeamAthleteContacts,
  TeamMemberParams,
  TeamQrCode,
  TeamRoster,
  UpdateTeamRequest,
} from '@team-impact/contracts';
import type { ZodApp } from '../../zod';
import * as area from '../team';
import type { MockWorld } from '../world';
import { httpError, type Guards } from './context';

/**
 * Coach team management: join approvals, the roster, removing members, QR codes, coach invites and
 * team edits. Every write is for the team's coaches (and staff); the roster is for the team itself.
 */
export const registerTeamRoutes = (app: ZodApp, world: MockWorld, { viewer }: Guards) => {
  /** The team must exist and the viewer may see it; 404 otherwise so outsiders learn nothing. */
  const visibleTeam = (request: FastifyRequest, teamId: string) => {
    const u = viewer(request);
    if (!area.team(world, teamId) || !area.canSeeRoster(world, u, teamId)) {
      throw httpError(404, 'No such team');
    }
    return u;
  };

  /** Coaches of the team and staff; other members get a 403. */
  const managedTeam = (request: FastifyRequest, teamId: string) => {
    const u = visibleTeam(request, teamId);
    if (!area.canManageTeam(world, u, teamId)) {
      throw httpError(403, 'Only this team’s coaches can do that');
    }
    return u;
  };

  /** QR tokens let anyone join, so only the team's own coaches get them (not staff). */
  const coachedTeam = (request: FastifyRequest, teamId: string) => {
    const u = visibleTeam(request, teamId);
    if (!area.isCoachOf(world, u, teamId)) {
      throw httpError(403, 'Only this team’s coaches can see its codes');
    }
    return u;
  };

  const qrCode = (request: FastifyRequest, codeId: string) => {
    const code = world.qrCodes.find((c) => c.id === codeId);
    if (!code) throw httpError(404, 'No such code');
    coachedTeam(request, code.teamId);
    return code;
  };

  // Team ------------------------------------------------------------------------------------------

  app.patch(
    '/teams/:id',
    { schema: { params: IdParams, body: UpdateTeamRequest, response: { 200: Team } } },
    async (request) => {
      const u = managedTeam(request, request.params.id);
      if (area.unreadableTeamColor(request.body.color)) {
        throw httpError(400, area.UNREADABLE_COLOR_MESSAGE);
      }
      const t = world.teams.find((x) => x.id === request.params.id)!;
      const fields = area.changedTeamFields(t, request.body);
      const updated = area.updateTeam(world, t.id, request.body)!;
      if (fields.includes('name')) area.renameTeamCommunity(world, t);
      if (fields.length) {
        world.track(u.id, { name: 'team.updated', properties: { teamId: t.id, fields } });
      }
      return updated;
    },
  );

  // Join requests ---------------------------------------------------------------------------------

  app.get(
    '/teams/:id/join-requests',
    { schema: { params: IdParams, response: { 200: z.array(JoinRequest) } } },
    async (request) => {
      managedTeam(request, request.params.id);
      return area.pendingRequests(world, request.params.id);
    },
  );

  app.post(
    '/join-requests/:id/decision',
    { schema: { params: IdParams, body: DecideJoinRequest, response: { 200: JoinRequest } } },
    async (request) => {
      const u = viewer(request);
      const result = area.decideJoinRequest(world, u, request.params.id, request.body.decision);
      if ('error' in result) throw httpError(result.status, result.error);
      return result.request;
    },
  );

  // Roster ----------------------------------------------------------------------------------------

  app.get(
    '/teams/:id/members',
    { schema: { params: IdParams, response: { 200: TeamRoster } } },
    async (request) => {
      const u = visibleTeam(request, request.params.id);
      return area.roster(world, request.params.id, u)!;
    },
  );

  app.get(
    '/teams/:id/athlete-contacts',
    { schema: { params: IdParams, response: { 200: TeamAthleteContacts } } },
    async (request) => {
      const u = visibleTeam(request, request.params.id);
      const contacts = area.athleteContacts(world, request.params.id, u);
      if (!contacts)
        throw httpError(403, 'Only families on the team see athletes’ contact details');
      return contacts;
    },
  );

  app.delete(
    '/teams/:id/members/:userId',
    { schema: { params: TeamMemberParams, response: { 200: RemoveMemberResult } } },
    async (request) => {
      const { id, userId } = request.params;
      const u = managedTeam(request, id);
      const wasCoach = world.user(userId)?.role === 'coach';
      const result = area.removeMember(world, id, userId);
      if ('error' in result) throw httpError(result.status, result.error);
      if (wasCoach) {
        world.track(u.id, { name: 'coach.removed', subjectId: userId, properties: { teamId: id } });
      }
      return { roster: area.roster(world, id, u)!, removedChildren: result.removedChildren };
    },
  );

  // QR codes --------------------------------------------------------------------------------------

  app.get(
    '/teams/:id/qr-codes',
    { schema: { params: IdParams, response: { 200: z.array(TeamQrCode) } } },
    async (request) => {
      coachedTeam(request, request.params.id);
      return world.qrCodes
        .filter((c) => c.teamId === request.params.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((c) => area.qrCodeView(world, c));
    },
  );

  app.post(
    '/teams/:id/qr-codes',
    { schema: { params: IdParams, body: CreateQrCodeRequest, response: { 201: TeamQrCode } } },
    async (request, reply) => {
      const u = coachedTeam(request, request.params.id);
      const t = world.teams.find((x) => x.id === request.params.id)!;
      if (t.status !== 'live') throw httpError(409, 'Only live teams can make codes');
      const { lifetime, label } = request.body;
      const code = area.createQrCode(world, u, t.id, lifetime, label);
      return reply.status(201).send(area.qrCodeView(world, code));
    },
  );

  app.post(
    '/qr-codes/:id/revoke',
    { schema: { params: IdParams, response: { 200: TeamQrCode } } },
    async (request) => {
      const code = qrCode(request, request.params.id);
      return area.qrCodeView(world, area.revokeQrCode(code));
    },
  );

  app.get(
    '/qr-codes/:id/joins',
    { schema: { params: IdParams, response: { 200: z.array(QrCodeJoin) } } },
    async (request) => area.qrCodeJoins(world, qrCode(request, request.params.id)),
  );

  // Coach invites ---------------------------------------------------------------------------------

  app.get(
    '/teams/:id/coach-invites',
    { schema: { params: IdParams, response: { 200: z.array(CoachInvite) } } },
    async (request) => {
      managedTeam(request, request.params.id);
      return area
        .pendingCoachInvites(world, request.params.id)
        .map((i) => area.coachInviteView(world, i));
    },
  );

  app.post(
    '/teams/:id/coach-invites',
    { schema: { params: IdParams, body: InviteCoachRequest, response: { 201: CoachInvite } } },
    async (request, reply) => {
      const u = managedTeam(request, request.params.id);
      const result = area.createCoachInvite(world, u, request.params.id, request.body.email);
      if ('error' in result) throw httpError(result.status, result.error);
      world.track(u.id, {
        name: 'coach.invited',
        properties: { teamId: request.params.id, inviteId: result.invite.id },
      });
      return reply.status(201).send(area.coachInviteView(world, result.invite));
    },
  );

  app.post(
    '/coach-invites/:id/revoke',
    { schema: { params: IdParams, response: { 200: CoachInvite } } },
    async (request) => {
      const invite = world.coachInvites.find((i) => i.id === request.params.id);
      if (!invite) throw httpError(404, 'No such invite');
      const u = managedTeam(request, invite.teamId);
      const result = area.revokeCoachInvite(invite);
      if ('error' in result) throw httpError(result.status, result.error);
      if (result.changed) {
        world.track(u.id, {
          name: 'coach.invite_revoked',
          properties: { teamId: invite.teamId, inviteId: invite.id },
        });
      }
      return area.coachInviteView(world, invite);
    },
  );
};
