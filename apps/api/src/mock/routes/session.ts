import type { FastifyReply } from 'fastify';
import { DevSignInRequest, Me } from '@team-impact/contracts';
import type { ZodApp } from '../../zod';
import { NEWCOMERS, SIGN_IN_AS } from '../fixtures';
import type { MockWorld } from '../world';
import { httpError, SESSION_COOKIE, type Guards } from './context';

/** Session: dev sign-in, sign-out, the signed-in user. */
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

  app.post('/auth/sign-out', async (_request, reply: FastifyReply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.status(204).send();
  });

  app.get('/me', { schema: { response: { 200: Me } } }, async (request) =>
    world.me(viewer(request)),
  );
};
