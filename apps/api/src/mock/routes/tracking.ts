import { TrackEventRequest } from '@team-impact/contracts';
import type { ZodApp } from '../../zod';
import type { MockWorld } from '../world';
import type { Guards } from './context';

/**
 * Client events (`track()` in the apps): checked against the contract and the session, then
 * dropped, since there's no events_log without the database.
 */
export const registerTrackingRoutes = (app: ZodApp, _world: MockWorld, { viewer }: Guards) => {
  app.post('/events', { schema: { body: TrackEventRequest } }, async (request, reply) => {
    viewer(request);
    return reply.status(204).send();
  });
};
