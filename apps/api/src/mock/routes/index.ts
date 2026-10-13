import type { ZodApp } from '../../zod';
import type { MockWorld } from '../world';
import { registerCommunityCreateRoutes } from './community-create';
import { registerCommunityRoutes } from './communities';
import { guards } from './context';
import { registerEventRoutes } from './events';
import { registerJoinRoutes } from './join';
import { registerNotificationRoutes } from './notifications';
import { registerPostRoutes } from './posts';
import { registerRecruiterRoutes } from './recruiter';
import { registerSessionRoutes } from './session';
import { registerStaffRoutes } from './staff';

/**
 * Every route the clients need for the shells, on fixture data (MOCK_API=1). Paths and shapes are
 * the ones the real API will serve, so swapping mocks for the database changes no client code.
 * One file per product area.
 */
export const registerMockRoutes = (app: ZodApp, world: MockWorld) => {
  const g = guards(world);
  for (const register of [
    registerSessionRoutes,
    registerCommunityRoutes,
    registerJoinRoutes,
    registerRecruiterRoutes,
    registerStaffRoutes,
    registerPostRoutes,
    registerEventRoutes,
    registerCommunityCreateRoutes,
    registerNotificationRoutes,
  ]) {
    register(app, world, g);
  }
};
