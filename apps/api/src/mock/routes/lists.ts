import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  CreateListRequest,
  IdParams,
  ListAthleteParams,
  RecruiterList,
  RecruiterListDetail,
  RecruiterNote,
  SetListNoteRequest,
  ShareListRequest,
  UpdateListRequest,
  UserSummary,
} from '@team-impact/contracts';
import type { ZodApp } from '../../zod';
import { summaryOf } from '../fixtures';
import type { MockUser, MockWorld } from '../world';
import { httpError, type Guards } from './context';

/**
 * Recruiter list writes (R6): create, rename, delete, share with colleagues at the same company,
 * add and remove athletes, and the company's note on each athlete. Only athletes recruiters can see
 * (published, open to recruiting, adult athletes) ever go on a list.
 */
export const registerListRoutes = (app: ZodApp, world: MockWorld, { requireRole }: Guards) => {
  const recruiter = (request: FastifyRequest) => requireRole(request, 'recruiter');

  /** A list the recruiter owns or was shared; 404 otherwise, so other companies' lists stay unseen. */
  const listOf = (u: MockUser, id: string) => {
    const list = world.listsFor(u).find((l) => l.id === id);
    if (!list) throw httpError(404, 'No such list');
    return list;
  };
  const ownListOf = (u: MockUser, id: string) => {
    const list = listOf(u, id);
    if (list.ownerId !== u.id) throw httpError(403, 'Only the list’s owner can do that');
    return list;
  };
  const touch = (l: { updatedAt: string }) => (l.updatedAt = new Date().toISOString());

  const colleagues = (u: MockUser) =>
    world.users.filter(
      (x) => x.role === 'recruiter' && x.companyId === u.companyId && x.id !== u.id,
    );

  const checkColleagues = (u: MockUser, ids: string[]) => {
    const allowed = new Set(colleagues(u).map((x) => x.id));
    if (!ids.every((id) => allowed.has(id))) {
      throw httpError(400, 'Lists can only be shared with colleagues at your company');
    }
  };

  const nameTaken = (u: MockUser, name: string, except?: string) =>
    world.lists.some(
      (l) =>
        l.companyId === u.companyId &&
        l.id !== except &&
        l.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );

  /**
   * On the employer portal at all (never a child, teen or athlete who isn't open to recruiting),
   * and not across a block with `u`.
   */
  const visibleAthlete = (athleteId: string, u: MockUser) => {
    const card = world.cards.find((c) => c.face.athleteId === athleteId);
    if (!card || !world.canReadCard(card, u)) throw httpError(404, 'No such athlete');
    return card;
  };

  app.get(
    '/company/colleagues',
    { schema: { response: { 200: z.array(UserSummary) } } },
    async (request) => colleagues(recruiter(request)).map(summaryOf),
  );

  app.post(
    '/lists',
    { schema: { body: CreateListRequest, response: { 201: RecruiterList } } },
    async (request, reply) => {
      const u = recruiter(request);
      if (nameTaken(u, request.body.name))
        throw httpError(409, 'Your company has a list by that name');
      const now = new Date().toISOString();
      const list = {
        id: world.newId(),
        companyId: u.companyId!,
        name: request.body.name,
        color: request.body.color,
        note: request.body.note || null,
        ownerId: u.id,
        sharedWithIds: [],
        entries: [],
        createdAt: now,
        updatedAt: now,
      };
      world.lists.push(list);
      return reply.status(201).send(world.list(list, u));
    },
  );

  app.patch(
    '/lists/:id',
    { schema: { params: IdParams, body: UpdateListRequest, response: { 200: RecruiterList } } },
    async (request) => {
      const u = recruiter(request);
      const list = ownListOf(u, request.params.id);
      const b = request.body;
      if (b.name !== undefined && nameTaken(u, b.name, list.id)) {
        throw httpError(409, 'Your company has a list by that name');
      }
      if (b.sharedWithUserIds) checkColleagues(u, b.sharedWithUserIds);
      if (b.name !== undefined) list.name = b.name;
      if (b.color !== undefined) list.color = b.color;
      if (b.note !== undefined) list.note = b.note || null;
      if (b.sharedWithUserIds) list.sharedWithIds = [...new Set(b.sharedWithUserIds)];
      touch(list);
      return world.list(list, u);
    },
  );

  app.delete('/lists/:id', { schema: { params: IdParams } }, async (request, reply) => {
    const u = recruiter(request);
    const list = ownListOf(u, request.params.id);
    // Notes are company-wide and stay (see RecruiterNote).
    world.lists.splice(world.lists.indexOf(list), 1);
    return reply.status(204).send();
  });

  app.post(
    '/lists/:id/share',
    { schema: { params: IdParams, body: ShareListRequest, response: { 200: RecruiterList } } },
    async (request) => {
      const u = recruiter(request);
      const list = ownListOf(u, request.params.id);
      checkColleagues(u, [request.body.userId]);
      if (!list.sharedWithIds.includes(request.body.userId)) {
        list.sharedWithIds.push(request.body.userId);
        touch(list);
      }
      return world.list(list, u);
    },
  );

  app.post(
    '/lists/:id/athletes/:athleteId',
    { schema: { params: ListAthleteParams, response: { 200: RecruiterListDetail } } },
    async (request) => {
      const u = recruiter(request);
      const list = listOf(u, request.params.id);
      const { athleteId } = request.params;
      visibleAthlete(athleteId, u);
      if (list.entries.some((e) => e.athleteId === athleteId)) {
        throw httpError(409, 'Already on this list');
      }
      list.entries.push({ athleteId, addedById: u.id, addedAt: new Date().toISOString() });
      touch(list);
      return world.listDetail(list, u);
    },
  );

  app.delete(
    '/lists/:id/athletes/:athleteId',
    { schema: { params: ListAthleteParams, response: { 200: RecruiterListDetail } } },
    async (request) => {
      const u = recruiter(request);
      const list = listOf(u, request.params.id);
      const before = list.entries.length;
      list.entries = list.entries.filter((e) => e.athleteId !== request.params.athleteId);
      if (list.entries.length === before) throw httpError(404, 'Not on this list');
      touch(list);
      return world.listDetail(list, u);
    },
  );

  app.put(
    '/lists/:id/athletes/:athleteId/note',
    {
      schema: {
        params: ListAthleteParams,
        body: SetListNoteRequest,
        response: { 200: RecruiterNote },
      },
    },
    async (request) => {
      const u = recruiter(request);
      const list = listOf(u, request.params.id);
      const { athleteId } = request.params;
      if (!list.entries.some((e) => e.athleteId === athleteId)) {
        throw httpError(404, 'Not on this list');
      }
      visibleAthlete(athleteId, u);
      const note = {
        id: world.newId(),
        athleteId,
        author: summaryOf(u),
        text: request.body.text,
        createdAt: new Date().toISOString(),
      };
      world.notes.push(note);
      touch(list);
      return note;
    },
  );
};
