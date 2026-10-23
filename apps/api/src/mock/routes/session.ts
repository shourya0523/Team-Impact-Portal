import { DevSignInRequest, Me, SignOutRequest, UpdateMeRequest } from '@team-impact/contracts';
import { prefsOf } from '../activity';
import type { ZodApp } from '../../zod';
import { NEWCOMERS, SIGN_IN_AS } from '../fixtures';
import type { MockWorld } from '../world';
import { httpError, SESSION_COOKIE, type Guards } from './context';

/** Session: dev sign-in, sign-out, the signed-in user and editing their plain profile. */
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
      if (notificationPrefs) {
        world.notificationPrefs.set(u.id, { ...prefsOf(world, u.id), ...notificationPrefs });
      }
      return world.me(u);
    },
  );
};
