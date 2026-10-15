import { z } from 'zod';
import { IdParams, ModerationLogEntry, Recruiter, SuspendedUser } from '@team-impact/contracts';
import type { ZodApp } from '../../zod';
import { summaryOf } from '../fixtures';
import { isSuspended, moderationLog, suspend, suspendedUsers, unsuspend } from '../staff-tools';
import type { MockUser, MockWorld } from '../world';
import { httpError, type Guards } from './context';

/**
 * Staff tools on accounts: declining recruiter sign-ups, suspending and restoring recruiters, the
 * suspended-accounts list and the moderation action log (PRD §9, Notion "Moderation").
 */
export const registerStaffToolsRoutes = (
  app: ZodApp,
  world: MockWorld,
  { requireRole }: Guards,
) => {
  const recruiterOut = (u: MockUser): Recruiter => ({
    user: summaryOf(u),
    email: u.email,
    title: u.title ?? null,
    companyId: u.companyId!,
    suspended: isSuspended(world, u.id),
    joinedAt: u.createdAt,
  });

  app.post(
    '/staff/recruiter-sign-ups/:id/decline',
    { schema: { params: IdParams } },
    async (request, reply) => {
      requireRole(request, 'staff');
      const pending = world.signup.pendingRecruiters;
      const i = pending.findIndex((r) => r.id === request.params.id);
      if (i < 0) throw httpError(404, 'No such sign-up');
      // No account was ever made, so declining just drops the request.
      pending.splice(i, 1);
      return reply.status(204).send();
    },
  );

  app.get(
    '/staff/recruiters',
    { schema: { response: { 200: z.array(Recruiter) } } },
    async (request) => {
      requireRole(request, 'staff');
      return world.users
        .filter((u) => u.role === 'recruiter' && u.companyId)
        .sort((a, b) => a.lastName.localeCompare(b.lastName))
        .map(recruiterOut);
    },
  );

  const findRecruiter = (id: string) => {
    const u = world.user(id);
    if (!u || u.role !== 'recruiter') throw httpError(404, 'No such recruiter');
    return u;
  };

  app.post(
    '/staff/recruiters/:id/suspend',
    { schema: { params: IdParams, response: { 200: Recruiter } } },
    async (request) => {
      const staff = requireRole(request, 'staff');
      const u = findRecruiter(request.params.id);
      const refused = suspend(world, staff, u);
      if (refused) throw httpError(refused.status, refused.message);
      return recruiterOut(u);
    },
  );

  app.post(
    '/staff/recruiters/:id/restore',
    { schema: { params: IdParams, response: { 200: Recruiter } } },
    async (request) => {
      const staff = requireRole(request, 'staff');
      const u = findRecruiter(request.params.id);
      unsuspend(world, staff, u);
      return recruiterOut(u);
    },
  );

  app.get(
    '/staff/suspended-users',
    { schema: { response: { 200: z.array(SuspendedUser) } } },
    async (request) => {
      requireRole(request, 'staff');
      return suspendedUsers(world);
    },
  );

  app.post(
    '/staff/users/:id/unsuspend',
    { schema: { params: IdParams, response: { 200: z.array(SuspendedUser) } } },
    async (request) => {
      const staff = requireRole(request, 'staff');
      const u = world.user(request.params.id);
      if (!u || !unsuspend(world, staff, u)) throw httpError(404, 'That account isn’t suspended');
      return suspendedUsers(world);
    },
  );

  app.get(
    '/staff/moderation/log',
    { schema: { response: { 200: z.array(ModerationLogEntry) } } },
    async (request) => {
      requireRole(request, 'staff');
      return moderationLog(world);
    },
  );
};
