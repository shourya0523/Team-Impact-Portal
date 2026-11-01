import {
  canCreateCommunity,
  Community,
  CreateCommunityRequest,
  IdParams,
} from '@team-impact/contracts';
import type { ZodApp } from '../../zod';
import { BLOCKED_MESSAGE, screenNew, settleScreen, statusOf } from '../activity';
import type { MockCommunity } from '../fixtures';
import type { MockWorld } from '../world';
import { httpError, type Guards } from './context';
import { seenCommunity } from './posts';

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Creating an interest or medical community (open or private), and leaving one. */
export const registerCommunityCreateRoutes = (
  app: ZodApp,
  world: MockWorld,
  { viewer }: Guards,
) => {
  app.post(
    '/communities',
    { schema: { body: CreateCommunityRequest, response: { 201: Community } } },
    async (request, reply) => {
      const u = viewer(request);
      const { kind, name, about } = request.body;
      // With the medical switch off the kind doesn't exist anywhere (PRD §11).
      if (kind === 'medical' && !world.flags.medicalCommunities) {
        throw httpError(400, 'Choose a kind of community');
      }
      if (!canCreateCommunity(u.role, kind)) {
        throw httpError(403, 'You can’t create this kind of community');
      }
      // Names are unique per kind, ignoring case; held names count, removed ones don't.
      const taken = world.communities.some(
        (c) => c.kind === kind && c.moderation !== 'removed' && sameName(c.name, name),
      );
      if (taken) throw httpError(409, 'A community with that name already exists');
      const verdict = await screenNew(world, u, { text: `${name}\n${about}` });
      const now = new Date().toISOString();
      const userMade = {
        id: world.newId(),
        name,
        about,
        // Name and description are screened like posts; while held, only staff and the
        // creator see it.
        moderation: statusOf(verdict),
        createdAt: now,
        createdById: u.id,
        private: request.body.private,
        requests: [],
        members: [{ userId: u.id, joinedAt: now, recruiterSearchOptIn: false }],
      };
      const created: MockCommunity =
        kind === 'interest'
          ? { ...userMade, kind: 'interest', official: false }
          : { ...userMade, kind: 'medical' };
      world.communities.push(created);
      settleScreen(world, { kind: 'community', id: created.id }, `${name}: ${about}`, verdict);
      if (verdict.outcome === 'block') throw httpError(422, BLOCKED_MESSAGE);
      return reply.status(201).send(world.community(created, u));
    },
  );

  app.post(
    '/communities/:id/leave',
    { schema: { params: IdParams, response: { 200: Community } } },
    async (request) => {
      const u = viewer(request);
      const c = seenCommunity(world, u, request.params.id);
      if (c.kind !== 'interest' && c.kind !== 'medical') {
        throw httpError(400, 'Team and Team Impact communities can’t be left');
      }
      // PRD §11 leaves open who runs a community after its creator; until then they stay.
      if (c.createdById === u.id)
        throw httpError(400, 'You created this community, so you stay in it');
      // Dropping the membership drops the recruiter opt-in with it; rejoining starts it off.
      c.members = c.members.filter((m) => m.userId !== u.id);
      c.requests = c.requests.filter((r) => r.userId !== u.id);
      return world.community(c, u);
    },
  );
};
