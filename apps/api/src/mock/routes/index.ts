import type { ResumeReaderConfig } from '../../resume';
import type { ZodApp } from '../../zod';
import type { MockWorld } from '../world';
import { registerCommunityCreateRoutes } from './community-create';
import { registerCardRoutes } from './cards';
import { registerCommunityRoutes } from './communities';
import { registerCommunityMemberRoutes } from './community-members';
import { guards } from './context';
import { registerEventRoutes } from './events';
import { registerJoinRoutes } from './join';
import { registerListRoutes } from './lists';
import { registerNotificationRoutes } from './notifications';
import { registerPostRoutes } from './posts';
import { registerProfileRoutes } from './profiles';
import { registerRecruiterRoutes } from './recruiter';
import { registerSafetyRoutes } from './safety';
import { registerSessionRoutes } from './session';
import { registerStaffAdminRoutes } from './staff-admin';
import { registerSignupRoutes } from './signup';
import { registerStaffRoutes } from './staff';
import { registerStaffToolsRoutes } from './staff-tools';
import { registerTeamRoutes } from './team';
import { registerTrackingRoutes } from './tracking';

/**
 * Every route the clients need for the shells, on fixture data (MOCK_API=1). Paths and shapes are
 * the ones the real API will serve, so swapping mocks for the database changes no client code.
 * One file per product area.
 */
export interface MockRouteOptions {
  /** How uploaded resumes are read (OCR sidecar, optional LLM). */
  resume?: ResumeReaderConfig;
}

export const registerMockRoutes = (
  app: ZodApp,
  world: MockWorld,
  options: MockRouteOptions = {},
) => {
  const g = guards(world);
  for (const register of [
    registerSessionRoutes,
    registerCommunityRoutes,
    registerJoinRoutes,
    registerRecruiterRoutes,
    registerStaffRoutes,
    registerSafetyRoutes,
    registerStaffAdminRoutes,
    registerListRoutes,
    registerTeamRoutes,
    registerSignupRoutes,
    registerPostRoutes,
    registerEventRoutes,
    registerCommunityCreateRoutes,
    registerNotificationRoutes,
    registerProfileRoutes,
    (a: ZodApp, w: MockWorld, gg: typeof g) => registerCardRoutes(a, w, gg, options.resume),
    registerCommunityMemberRoutes,
    registerStaffToolsRoutes,
    registerTrackingRoutes,
  ]) {
    register(app, world, g);
  }
};
