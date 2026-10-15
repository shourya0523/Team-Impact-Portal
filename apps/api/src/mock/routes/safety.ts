import { z } from 'zod';
import { Block, CreateReportRequest, MyReport, UserIdParams } from '@team-impact/contracts';
import type { ZodApp } from '../../zod';
import { summaryOf } from '../fixtures';
import { deleteAccount, fileReport, myReport, reportTarget } from '../safety';
import type { MockWorld } from '../world';
import { httpError, SESSION_COOKIE, type Guards } from './context';

/** Trust and safety (PRD §9): reports, blocks and account deletion. Every signed-in role. */
export const registerSafetyRoutes = (app: ZodApp, world: MockWorld, { viewer }: Guards) => {
  app.post(
    '/reports',
    { schema: { body: CreateReportRequest, response: { 201: MyReport } } },
    async (request, reply) => {
      const u = viewer(request);
      const { target } = request.body;
      // One report per person per item: a second tap can't stack up a ticket.
      if (world.reports.some((r) => r.reporterId === u.id && r.target.id === target.id)) {
        throw httpError(409, 'You already reported this');
      }
      const found = reportTarget(world, u, target);
      if (!found) throw httpError(404, 'Nothing to report here');
      const report = fileReport(world, u, request.body, found.preview);
      return reply.status(201).send(myReport(world, report));
    },
  );

  app.get('/me/reports', { schema: { response: { 200: z.array(MyReport) } } }, async (request) => {
    const u = viewer(request);
    return world.reports
      .filter((r) => r.reporterId === u.id)
      .map((r) => myReport(world, r))
      .reverse();
  });

  app.get('/blocks', { schema: { response: { 200: z.array(Block) } } }, async (request) => {
    const u = viewer(request);
    return world.blocks
      .filter((b) => b.blockerId === u.id)
      .map((b) => ({ user: summaryOf(world.user(b.blockedId)!), blockedAt: b.createdAt }));
  });

  app.post(
    '/blocks/:userId',
    { schema: { params: UserIdParams, response: { 201: Block } } },
    async (request, reply) => {
      const u = viewer(request);
      const other = world.user(request.params.userId);
      if (!other) throw httpError(404, 'No such person');
      if (other.id === u.id) throw httpError(400, 'You can’t block yourself');
      // Team Impact's own posts can't be blocked; report one instead.
      if (other.role === 'staff') throw httpError(400, 'Team Impact staff can’t be blocked');
      const existing = world.blocks.find((b) => b.blockerId === u.id && b.blockedId === other.id);
      const block = existing ?? {
        blockerId: u.id,
        blockedId: other.id,
        createdAt: new Date().toISOString(),
      };
      if (!existing) world.blocks.push(block);
      return reply.status(201).send({ user: summaryOf(other), blockedAt: block.createdAt });
    },
  );

  app.delete('/blocks/:userId', { schema: { params: UserIdParams } }, async (request, reply) => {
    const u = viewer(request);
    const i = world.blocks.findIndex(
      (b) => b.blockerId === u.id && b.blockedId === request.params.userId,
    );
    if (i === -1) throw httpError(404, 'You haven’t blocked this person');
    world.blocks.splice(i, 1);
    return reply.status(204).send();
  });

  app.delete('/me', async (request, reply) => {
    const u = viewer(request);
    const error = deleteAccount(world, u);
    if (error) throw httpError(...error);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.status(204).send();
  });
};
