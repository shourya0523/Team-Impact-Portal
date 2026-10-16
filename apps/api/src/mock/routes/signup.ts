import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  AcceptCoachInviteBody,
  ageBand,
  ageOn,
  CoachInvitePreview,
  emailOnDomain,
  IdParams,
  InviteParams,
  Me,
  PendingRecruiter,
  QrCodeParams,
  QrCodePreview,
  QrJoinResult,
  Recruiter,
  RecruiterSignupRequest,
  RecruiterSignupResult,
  SignupRequest,
} from '@team-impact/contracts';
import type { ZodApp } from '../../zod';
import { summaryOf } from '../fixtures';
import { acceptCoachInvite, redeemQrCode, usableInvite, usableQrCode } from '../team';
import type { MockUser, MockWorld } from '../world';
import { httpError, SESSION_COOKIE, type Guards } from './context';

/**
 * Sign-up and joining without a coach's approval step: open sign-up, team QR codes, coach invites
 * and recruiter sign-up. The mock keeps no passwords: accounts live only in the world, and signing
 * up sets the same session cookie as dev sign-in. The real API hashes passwords with argon2.
 */
export const registerSignupRoutes = (
  app: ZodApp,
  world: MockWorld,
  { viewer, requireRole }: Guards,
) => {
  const startSession = (reply: FastifyReply, u: MockUser) =>
    reply.setCookie(SESSION_COOKIE, u.id, {
      signed: true,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });

  /** The signed-in user, or null: invite and QR previews work signed out. */
  const maybeViewer = (request: FastifyRequest) => {
    try {
      return viewer(request);
    } catch {
      return null;
    }
  };

  const emailTaken = (email: string) =>
    world.users.some((u) => u.email === email) ||
    world.signup.pendingRecruiters.some((r) => r.email === email);

  const createUser = (fields: Omit<MockUser, 'id' | 'createdAt'>): MockUser => {
    const u: MockUser = { ...fields, id: world.newId(), createdAt: new Date().toISOString() };
    world.users.push(u);
    return u;
  };

  // Open sign-up -----------------------------------------------------------------------------------

  app.post(
    '/auth/sign-up',
    { schema: { body: SignupRequest, response: { 201: Me } } },
    async (request, reply) => {
      const body = request.body;
      // The contract already refuses these; checked again so no path creates a child's account.
      const band = ageBand(ageOn(body.birthDate));
      if (band === 'child') {
        throw httpError(
          400,
          'You need to be 13 or older to sign up. A parent or guardian can sign up and add you to the team.',
        );
      }
      if (band === 'teen' && (body.role !== 'teen' || body.parentAgreed !== true)) {
        throw httpError(400, 'Under 18s join as a teammate, with a parent or guardian’s OK');
      }
      if (emailTaken(body.email)) throw httpError(409, 'That email already has an account');
      // Birth date is used only for the age check above and isn't kept by the mock.
      const u = createUser({
        firstName: body.firstName,
        lastName: body.lastName,
        role: body.role,
        email: body.email,
      });
      world.track(u.id, { name: 'user.signed_up', properties: { role: u.role } });
      startSession(reply, u);
      return reply.status(201).send(world.me(u));
    },
  );

  // Team QR codes: the fast lane ---------------------------------------------------------------

  const liveCode = (token: string) => {
    const code = usableQrCode(world, token);
    if ('status' in code) throw httpError(code.status, code.message);
    return code;
  };

  app.get(
    '/qr/:code',
    { schema: { params: QrCodeParams, response: { 200: QrCodePreview } } },
    async (request) => {
      const code = liveCode(request.params.code);
      return {
        team: world.teamSummary(code.teamId),
        sharedBy: summaryOf(world.user(code.createdById)!),
        expiresAt: code.expiresAt,
      };
    },
  );

  app.post(
    '/qr/:code/join',
    { schema: { params: QrCodeParams, response: { 201: QrJoinResult } } },
    async (request, reply) => {
      // Only people who could ask to join can scan in; coaches are invited, others never join.
      const u = requireRole(request, 'athlete', 'parent', 'teen');
      // Shared with coach team management, so the join lands on the code's join list.
      const result = redeemQrCode(world, u, request.params.code);
      if ('status' in result) throw httpError(result.status, result.message);
      const { code } = result;
      if (!result.joined) throw httpError(409, 'You’re already on this team');
      world.track(u.id, {
        name: 'qr_code.redeemed',
        properties: { teamId: code.teamId, qrCodeId: code.id },
      });
      // A scan answers the scanner's own waiting request for the team. A parent's request that
      // adds children stays with the coach: children only ever join through an approval.
      for (const r of world.joinRequests) {
        const hasChildren = r.role === 'parent' && (r.children?.length ?? 0) > 0;
        if (
          r.requester.id === u.id &&
          r.teamId === code.teamId &&
          r.status === 'pending' &&
          !hasChildren
        ) {
          r.status = 'approved';
          r.decidedAt = new Date().toISOString();
        }
      }
      return reply.status(201).send({
        team: world.teamSummary(code.teamId),
        joinedAt: new Date().toISOString(),
      });
    },
  );

  // Coach invites ----------------------------------------------------------------------------------

  const openInvite = (token: string) => {
    const invite = usableInvite(world, token);
    if ('status' in invite) throw httpError(invite.status, invite.message);
    return invite;
  };

  app.get(
    '/invites/:token',
    { schema: { params: InviteParams, response: { 200: CoachInvitePreview } } },
    async (request) => {
      const invite = openInvite(request.params.token);
      return {
        team: world.teamSummary(invite.teamId),
        email: invite.email,
        invitedBy: summaryOf(world.user(invite.invitedById)!),
        expiresAt: invite.expiresAt,
        hasAccount: world.users.some((u) => u.email === invite.email),
      };
    },
  );

  app.post(
    '/invites/:token/accept',
    { schema: { params: InviteParams, body: AcceptCoachInviteBody, response: { 200: Me } } },
    async (request, reply) => {
      const invite = openInvite(request.params.token);
      const signedIn = maybeViewer(request);
      const existing = world.users.find((u) => u.email === invite.email);
      let coach: MockUser;
      if (signedIn) {
        if (signedIn.email !== invite.email) {
          throw httpError(403, `This invite is for ${invite.email}. Sign out, then open it again.`);
        }
        if (signedIn.role !== 'coach') {
          throw httpError(409, 'This email has a non-coach account. Contact Team Impact.');
        }
        coach = signedIn;
      } else if (existing) {
        throw httpError(409, 'That email already has an account. Sign in, then open the invite.');
      } else {
        const fresh = request.body.newAccount;
        if (!fresh) throw httpError(400, 'Create your account to accept the invite');
        coach = createUser({
          firstName: fresh.firstName,
          lastName: fresh.lastName,
          role: 'coach',
          email: invite.email,
        });
        world.track(coach.id, { name: 'user.signed_up', properties: { role: 'coach' } });
      }
      // A team's first coach makes it live: it shows in the join search from now on.
      acceptCoachInvite(world, invite, coach);
      world.track(coach.id, {
        name: 'coach.added',
        subjectId: coach.id,
        properties: { teamId: invite.teamId, via: 'invite' },
      });
      startSession(reply, coach);
      return world.me(coach);
    },
  );

  // Recruiters -------------------------------------------------------------------------------------

  app.post(
    '/auth/recruiter-sign-up',
    { schema: { body: RecruiterSignupRequest, response: { 202: RecruiterSignupResult } } },
    async (request, reply) => {
      const body = request.body;
      const company = world.companies.find((c) =>
        c.domains.some((d) => emailOnDomain(body.email, d)),
      );
      if (!company) {
        throw httpError(
          404,
          'Your company isn’t a Team Impact partner yet. Ask your partnership contact to get in touch.',
        );
      }
      if (company.status === 'suspended') {
        throw httpError(403, 'Your company’s access to Team Impact is paused.');
      }
      if (emailTaken(body.email)) throw httpError(409, 'That email already has an account');
      world.signup.pendingRecruiters.push({
        id: world.newId(),
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        title: body.title ?? null,
        companyId: company.id,
        requestedAt: new Date().toISOString(),
      });
      // No session: a pending recruiter can't see athletes until staff approve them.
      return reply.status(202).send({
        status: 'pending',
        email: body.email,
        company: { id: company.id, name: company.name },
      });
    },
  );

  const companyRef = (companyId: string) => {
    const c = world.companies.find((x) => x.id === companyId)!;
    return { id: c.id, name: c.name };
  };

  app.get(
    '/staff/recruiter-sign-ups',
    { schema: { response: { 200: z.array(PendingRecruiter) } } },
    async (request) => {
      requireRole(request, 'staff');
      return world.signup.pendingRecruiters.map(({ companyId, ...r }) => ({
        ...r,
        company: companyRef(companyId),
      }));
    },
  );

  app.post(
    '/staff/recruiter-sign-ups/:id/approve',
    { schema: { params: IdParams, response: { 200: Recruiter } } },
    async (request) => {
      requireRole(request, 'staff');
      const pending = world.signup.pendingRecruiters.find((r) => r.id === request.params.id);
      if (!pending) throw httpError(404, 'No such sign-up');
      const company = world.companies.find((c) => c.id === pending.companyId)!;
      if (company.status === 'suspended') {
        throw httpError(409, 'Restore the company before approving its recruiters');
      }
      world.signup.pendingRecruiters.splice(world.signup.pendingRecruiters.indexOf(pending), 1);
      const u = createUser({
        firstName: pending.firstName,
        lastName: pending.lastName,
        role: 'recruiter',
        email: pending.email,
        companyId: company.id,
        ...(pending.title ? { title: pending.title } : {}),
      });
      // The account exists once staff approve, so that's when the recruiter counts as signed up.
      world.track(u.id, { name: 'user.signed_up', properties: { role: 'recruiter' } });
      return {
        user: summaryOf(u),
        email: u.email,
        title: pending.title,
        companyId: company.id,
        suspended: false,
        joinedAt: u.createdAt,
      };
    },
  );
};
