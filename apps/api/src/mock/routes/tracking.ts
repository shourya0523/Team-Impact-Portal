import { TrackEventRequest } from '@team-impact/contracts';
import type { ZodApp } from '../../zod';
import type { MockWorld } from '../world';
import { httpError, type Guards } from './context';

/**
 * Client events (`track()` in the apps), checked against the contract and the session like the
 * database route, into the mock's events log. Events about someone who doesn't exist are refused.
 */
export const registerTrackingRoutes = (app: ZodApp, world: MockWorld, { viewer }: Guards) => {
  app.post('/events', { schema: { body: TrackEventRequest } }, async (request, reply) => {
    const u = viewer(request);
    if (!world.user(request.body.subjectId)) throw httpError(404, 'No such user.');
    world.track(u.id, request.body);
    return reply.status(204).send();
  });
};
