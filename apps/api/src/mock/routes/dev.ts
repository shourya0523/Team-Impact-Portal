import { z } from 'zod';
import type { ZodApp } from '../../zod';
import type { MockWorld } from '../world';

const OutboxQuery = z.object({ to: z.string().optional() });

/**
 * Development only, like the rest of the mock: the email the mock "sent", newest first. Optionally
 * for one address (`?to=`). The real API has no such route; real email lands in real inboxes.
 */
export const registerDevRoutes = (app: ZodApp, world: MockWorld) => {
  app.get('/dev/outbox', { schema: { querystring: OutboxQuery } }, async (request) =>
    world.outbox.filter((e) => !request.query.to || e.to === request.query.to).toReversed(),
  );
};
