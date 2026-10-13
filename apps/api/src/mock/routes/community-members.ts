import { z } from 'zod';
import { CalendarEvent, CommunityMember, IdParams } from '@team-impact/contracts';
import type { ZodApp } from '../../zod';
import { communityEvents, communityMembers } from '../community-members';
import type { MockUser } from '../fixtures';
import type { MockWorld } from '../world';
import { httpError, type Guards } from './context';

/** A community page's Events and Members tabs. */
export const registerCommunityMemberRoutes = (
  app: ZodApp,
  world: MockWorld,
  { viewer }: Guards,
) => {
  /** The community if `u` may know it exists; otherwise 404, never "it exists". */
  const visible = (u: MockUser, id: string) => {
    const c = world.communities.find((x) => x.id === id);
    if (!c || !world.canSeeCommunity(c, u)) throw httpError(404, 'No such community');
    return c;
  };

  app.get(
    '/communities/:id/events',
    { schema: { params: IdParams, response: { 200: z.array(CalendarEvent) } } },
    async (request) => {
      const u = viewer(request);
      return communityEvents(world, visible(u, request.params.id), u);
    },
  );

  app.get(
    '/communities/:id/members',
    { schema: { params: IdParams, response: { 200: z.array(CommunityMember) } } },
    async (request) => {
      const u = viewer(request);
      const result = communityMembers(world, visible(u, request.params.id), u);
      if ('error' in result) throw httpError(result.status, result.error);
      return result.members;
    },
  );
};
