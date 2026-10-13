import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  canCommentIn,
  canPostIn,
  Comment,
  CreateCommentRequest,
  IdParams,
  NewPostRequest,
  Post,
} from '@team-impact/contracts';
import type { ZodApp } from '../../zod';
import { commentsFor, holdForReview, toComment } from '../activity';
import type { MockCommunity, MockUser } from '../fixtures';
import type { MockWorld } from '../world';
import { httpError, type Guards } from './context';

/** A community the viewer may see, or 404 (also for medical ones while the switch is off). */
export const seenCommunity = (world: MockWorld, u: MockUser, id: string) => {
  const c = world.communities.find((x) => x.id === id);
  if (!c || !world.canSeeCommunity(c, u)) throw httpError(404, 'No such community');
  return c;
};

/** Posts, comments and rallies. Everything new is held for moderation (P5). */
export const registerPostRoutes = (app: ZodApp, world: MockWorld, { viewer }: Guards) => {
  const postView = (c: MockCommunity, u: MockUser, postId: string) =>
    world.postsIn(new Map([[c.id, c]]), u).find((p) => p.id === postId);

  /** A post the viewer can read: approved in a community they read, or their own held one. */
  const readablePost = (request: FastifyRequest, postId: string) => {
    const u = viewer(request);
    const p = world.posts.find((x) => x.id === postId);
    const c = p && world.communities.find((x) => x.id === p.communityId);
    if (!p || !c || !world.readsCommunity(c, u)) throw httpError(404, 'No such post');
    const view = postView(c, u, p.id);
    if (!view) throw httpError(404, 'No such post');
    return { u, p, c, view };
  };

  /** Rallies and comments only go on approved posts. */
  const approvedPost = (request: FastifyRequest, postId: string) => {
    const found = readablePost(request, postId);
    if (found.p.moderation !== 'approved') {
      throw httpError(409, 'This post is waiting for review');
    }
    return found;
  };

  app.post(
    '/communities/:id/posts',
    { schema: { params: IdParams, body: NewPostRequest, response: { 201: Post } } },
    async (request, reply) => {
      const u = viewer(request);
      const c = seenCommunity(world, u, request.params.id);
      if (!canPostIn(u.role, world.community(c, u))) {
        throw httpError(403, 'You can’t post in this community');
      }
      // Staff posts in Team Impact's community are its announcements (TI-146).
      const announcement = u.role === 'staff' && c.kind === 'team_impact';
      const created = {
        id: world.newId(),
        kind: announcement ? ('announcement' as const) : ('post' as const),
        authorId: u.id,
        communityId: c.id,
        text: request.body.text,
        imageUrl: request.body.imageUrl ?? null,
        official: u.role === 'staff',
        likeCount: 0,
        commentCount: 0,
        moderation: 'in_review' as const,
        createdAt: new Date().toISOString(),
      };
      world.posts.push(created);
      holdForReview(world, { kind: 'post', id: created.id }, created.text);
      return reply.status(201).send(postView(c, u, created.id)!);
    },
  );

  app.get(
    '/posts/:id',
    { schema: { params: IdParams, response: { 200: Post } } },
    async (request) => readablePost(request, request.params.id).view,
  );

  app.get(
    '/posts/:id/comments',
    { schema: { params: IdParams, response: { 200: z.array(Comment) } } },
    async (request) => {
      const { u, p } = readablePost(request, request.params.id);
      return commentsFor(world, p.id, u);
    },
  );

  app.post(
    '/posts/:id/comments',
    { schema: { params: IdParams, body: CreateCommentRequest, response: { 201: Comment } } },
    async (request, reply) => {
      const { u, p, c } = approvedPost(request, request.params.id);
      if (!canCommentIn(u.role, c.kind)) throw httpError(403, 'You can’t comment here');
      const created = {
        id: world.newId(),
        postId: p.id,
        authorId: u.id,
        text: request.body.text,
        moderation: 'in_review' as const,
        createdAt: new Date().toISOString(),
      };
      world.comments.push(created);
      holdForReview(world, { kind: 'comment', id: created.id }, created.text);
      return reply.status(201).send(toComment(world, created));
    },
  );

  const rally = async (request: FastifyRequest<{ Params: { id: string } }>, on: boolean) => {
    const { u, p, c } = approvedPost(request, request.params.id);
    // Recruiters read Team Impact and official communities; they don't react in them.
    if (u.role === 'recruiter') throw httpError(403, 'Not available for your role');
    const mine = world.rallies.findIndex((r) => r.postId === p.id && r.userId === u.id);
    if (on && mine === -1) {
      world.rallies.push({ postId: p.id, userId: u.id });
      p.likeCount += 1;
    } else if (!on && mine !== -1) {
      world.rallies.splice(mine, 1);
      p.likeCount = Math.max(0, p.likeCount - 1);
    }
    return postView(c, u, p.id)!;
  };

  app.post(
    '/posts/:id/rally',
    { schema: { params: IdParams, response: { 200: Post } } },
    async (request) => rally(request, true),
  );

  app.delete(
    '/posts/:id/rally',
    { schema: { params: IdParams, response: { 200: Post } } },
    async (request) => rally(request, false),
  );
};
