import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  CalendarEvent,
  Community,
  CommunityJoinRequest,
  DecideJoinRequest,
  Id,
  IdParams,
  page,
  PageQuery,
  Post,
  UpdateCommunityMembershipRequest,
} from '@team-impact/contracts';
import type { ZodApp } from '../../zod';
import type { MockWorld } from '../world';
import { notifyJoinApproved } from '../activity';
import { httpError, type Guards } from './context';

/** Communities, the home feed and events. */
export const registerCommunityRoutes = (app: ZodApp, world: MockWorld, { viewer }: Guards) => {
  app.get(
    '/communities',
    { schema: { response: { 200: z.array(Community) } } },
    async (request) => {
      const u = viewer(request);
      return world.communities
        .filter((c) => world.canSeeCommunity(c, u))
        .map((c) => world.community(c, u));
    },
  );

  app.get(
    '/communities/:id',
    { schema: { params: IdParams, response: { 200: Community } } },
    async (request) => {
      const u = viewer(request);
      const c = world.communities.find((x) => x.id === request.params.id);
      if (!c || !world.canSeeCommunity(c, u)) throw httpError(404, 'No such community');
      return world.community(c, u);
    },
  );

  const visibleCommunity = (request: FastifyRequest, id: string) => {
    const u = viewer(request);
    const c = world.communities.find((x) => x.id === id);
    if (!c || !world.canSeeCommunity(c, u)) throw httpError(404, 'No such community');
    return { u, c };
  };

  app.get(
    '/communities/:id/posts',
    { schema: { params: IdParams, querystring: PageQuery, response: { 200: page(Post) } } },
    async (request) => {
      // Can't see the community: 404 before the cursor is looked at, so a cursor can't probe it.
      const { u, c } = visibleCommunity(request, request.params.id);
      const feedPage = world.communityFeedPage(c, u, request.query);
      // A cursor we didn't issue, or one from another feed (`../feed.ts`).
      if (!feedPage) throw httpError(400, 'Invalid cursor. Start again from the first page.');
      return feedPage;
    },
  );

  app.post(
    '/communities/:id/join',
    { schema: { params: IdParams, response: { 200: Community } } },
    async (request) => {
      const { u, c } = visibleCommunity(request, request.params.id);
      const problem = world.join(c, u);
      if (problem) throw httpError(403, problem);
      return world.community(c, u);
    },
  );

  app.get(
    '/communities/:id/requests',
    { schema: { params: IdParams, response: { 200: z.array(CommunityJoinRequest) } } },
    async (request) => {
      const { u, c } = visibleCommunity(request, request.params.id);
      const requests = world.communityJoinRequests(c, u);
      if (!requests) throw httpError(403, 'Only the creator sees join requests');
      return requests;
    },
  );

  app.post(
    '/communities/:id/requests/:userId',
    {
      schema: {
        params: z.object({ id: Id, userId: Id }),
        body: DecideJoinRequest,
        response: { 200: z.array(CommunityJoinRequest) },
      },
    },
    async (request) => {
      const { u, c } = visibleCommunity(request, request.params.id);
      const problem = world.decideJoin(c, u, request.params.userId, request.body.decision);
      if (problem) throw httpError(problem === 'No such request' ? 404 : 403, problem);
      if (request.body.decision === 'approve')
        notifyJoinApproved(world, c, request.params.userId, u);
      return world.communityJoinRequests(c, u) ?? [];
    },
  );

  app.put(
    '/communities/:id/membership',
    {
      schema: {
        params: IdParams,
        body: UpdateCommunityMembershipRequest,
        response: { 200: Community },
      },
    },
    async (request) => {
      const { u, c } = visibleCommunity(request, request.params.id);
      const problem = world.setFindable(c, u, request.body.recruiterSearchOptIn);
      if (problem) throw httpError(400, problem);
      return world.community(c, u);
    },
  );

  app.get(
    '/feed',
    { schema: { querystring: PageQuery, response: { 200: page(Post) } } },
    async (request) => {
      const feedPage = world.feedPage(viewer(request), request.query);
      if (!feedPage) throw httpError(400, 'Invalid cursor. Start again from the first page.');
      return feedPage;
    },
  );

  app.get('/events', { schema: { response: { 200: z.array(CalendarEvent) } } }, async (request) =>
    world.eventsFor(viewer(request)),
  );
};
