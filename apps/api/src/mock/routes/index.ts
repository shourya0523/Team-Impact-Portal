import type { ZodApp } from '../../zod';
import type { MockWorld } from '../world';
import { registerCommunityRoutes } from './communities';
import { guards } from './context';
import { registerJoinRoutes } from './join';
import { registerRecruiterRoutes } from './recruiter';
import { registerSessionRoutes } from './session';
import { registerSignupRoutes } from './signup';
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
    registerSignupRoutes,
  ]) {
    register(app, world, g);
  }
};
