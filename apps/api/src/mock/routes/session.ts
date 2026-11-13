import {
  AcceptTermsRequest,
  CONSENT_FLAGS,
  CURRENT_TERMS_VERSION,
  DevSignInRequest,
  Me,
  mustAcceptTerms,
  SignOutRequest,
  TermsStatus,
  UpdateMeRequest,
} from '@team-impact/contracts';
import { prefsOf } from '../activity';
import { renameCard } from '../profiles';
import type { ZodApp } from '../../zod';
import { NEWCOMERS, SIGN_IN_AS } from '../fixtures';
import { latestTermsVersion } from '../signup';
import type { MockWorld } from '../world';
import { httpError, SESSION_COOKIE, type Guards } from './context';

/**
 * Session: dev sign-in, sign-out, the signed-in user, editing their plain profile and the terms
 * they've accepted.
 */
export const registerSessionRoutes = (app: ZodApp, world: MockWorld, { viewer }: Guards) => {
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

  app.post('/auth/sign-out', { schema: { body: SignOutRequest } }, async (request, reply) => {
    // Holding the token is proof of the phone, so this works without a session: a suspended
    // or expired user can still stop pushes to the phone they're signing out of.
    const token = request.body?.token;
    if (token) {
      const i = world.devices.findIndex((d) => d.token === token);
      if (i !== -1) world.devices.splice(i, 1);
    }
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.status(204).send();
  });

  app.get('/me', { schema: { response: { 200: Me } } }, async (request) =>
    world.me(viewer(request)),
  );

  const termsStatus = (userId: string): TermsStatus => {
    const accepted = latestTermsVersion(world.signup, userId);
    return { current: CURRENT_TERMS_VERSION, accepted, mustAccept: mustAcceptTerms(accepted) };
  };

  /** Whether the legal text changed since this account last accepted it (TI-107). */
  app.get('/me/terms', { schema: { response: { 200: TermsStatus } } }, async (request) =>
    termsStatus(viewer(request).id),
  );

  /** Accepting the current text again, recorded like a sign-up's acceptance. */
  app.post(
    '/me/terms',
    { schema: { body: AcceptTermsRequest, response: { 200: TermsStatus } } },
    async (request) => {
      const u = viewer(request);
      // The mock keeps no birth dates, so the teen role decides (it is set from age at sign-up).
      const teen = u.role === 'teen';
      if (teen && request.body.parentAgreed !== true) {
        throw httpError(400, 'Confirm a parent or guardian agreed to the new terms.');
      }
      const row = {
        userId: u.id,
        value: true,
        termsVersion: CURRENT_TERMS_VERSION,
        createdAt: new Date().toISOString(),
      };
      world.signup.consents.push({ ...row, flag: CONSENT_FLAGS.terms });
      if (teen) world.signup.consents.push({ ...row, flag: CONSENT_FLAGS.parentAgreed });
      return termsStatus(u.id);
    },
  );

  /**
   * The owner edits their plain profile (name; the photo comes with uploads). Role, team and
   * company aren't editable here: the contract doesn't accept them, so they can't be changed.
   */
  app.patch(
    '/me',
    { schema: { body: UpdateMeRequest, response: { 200: Me } } },
    async (request) => {
      const u = viewer(request);
      const { firstName, lastName, notificationPrefs } = request.body;
      if (firstName !== undefined) u.firstName = firstName;
      if (lastName !== undefined) u.lastName = lastName;
      if (firstName !== undefined || lastName !== undefined) renameCard(world, u);
      if (notificationPrefs) {
        world.notificationPrefs.set(u.id, { ...prefsOf(world, u.id), ...notificationPrefs });
      }
      return world.me(u);
    },
  );
};
