import { z } from 'zod';
import {
  canBeOpenToRecruiting,
  ChildProfile,
  hasBaseballCard,
  IdParams,
  MySettings,
  Profile,
  UpdateChildRequest,
  UpdateMySettingsRequest,
} from '@team-impact/contracts';
import type { ZodApp } from '../../zod';
import { cardOf, childProfile, profileFor, settingsFor } from '../profiles';
import type { MockWorld } from '../world';
import { httpError, type Guards } from './context';

/** Profiles (people and children) and the signed-in user's privacy settings. */
export const registerProfileRoutes = (
  app: ZodApp,
  world: MockWorld,
  { viewer, requireRole }: Guards,
) => {
  app.get(
    '/profiles/:id',
    { schema: { params: IdParams, response: { 200: Profile } } },
    async (request) => {
      const profile = profileFor(world, request.params.id, viewer(request));
      // Same answer for "doesn't exist" and "not yours to see", so a child's id leaks nothing.
      if (!profile) throw httpError(404, 'No such profile');
      return profile;
    },
  );

  app.get(
    '/children',
    { schema: { response: { 200: z.array(ChildProfile) } } },
    async (request) => {
      const u = requireRole(request, 'parent');
      return world.children.filter((c) => c.parentId === u.id).map((c) => childProfile(world, c));
    },
  );

  app.patch(
    '/children/:id',
    { schema: { params: IdParams, body: UpdateChildRequest, response: { 200: ChildProfile } } },
    async (request) => {
      const u = requireRole(request, 'parent');
      const child = world.children.find((c) => c.id === request.params.id && c.parentId === u.id);
      if (!child) throw httpError(404, 'No such child');
      const { firstName, age, bio } = request.body;
      if (firstName !== undefined) child.firstName = firstName;
      if (age !== undefined) child.age = age;
      if (bio !== undefined) child.bio = bio || null;
      return childProfile(world, child);
    },
  );

  app.get('/me/settings', { schema: { response: { 200: MySettings } } }, async (request) =>
    settingsFor(world, viewer(request)),
  );

  app.put(
    '/me/settings',
    { schema: { body: UpdateMySettingsRequest, response: { 200: MySettings } } },
    async (request) => {
      const u = viewer(request);
      const { contact, familiesSee, recruitersSee, openToRecruiting, searchable } = request.body;
      const touchesCard =
        contact !== undefined || familiesSee !== undefined || recruitersSee !== undefined;
      if (openToRecruiting !== undefined && !canBeOpenToRecruiting(u.role)) {
        throw httpError(
          403,
          u.role === 'teen'
            ? 'Teens can’t be open to recruiting'
            : 'Only athletes can be open to recruiting',
        );
      }
      if ((touchesCard || searchable?.length) && !hasBaseballCard(u.role)) {
        throw httpError(403, 'Only athletes share contacts through a Baseball Card');
      }
      const card = cardOf(world, u.id);
      if ((touchesCard || openToRecruiting !== undefined) && !card) {
        throw httpError(400, 'Create your Baseball Card first');
      }
      if (openToRecruiting && !card?.visibility.published) {
        throw httpError(400, 'Publish your Baseball Card first');
      }
      for (const s of searchable ?? []) {
        const c = world.communities.find((x) => x.id === s.communityId);
        if (!c || !world.canSeeCommunity(c, u)) throw httpError(404, 'No such community');
        const problem = world.setFindable(c, u, s.on);
        if (problem) throw httpError(400, problem);
      }
      if (card) {
        if (contact) Object.assign(card.contact, contact);
        if (familiesSee) Object.assign(card.visibility.familiesSee, familiesSee);
        if (recruitersSee) Object.assign(card.visibility.recruitersSee, recruitersSee);
        if (openToRecruiting !== undefined) card.visibility.openToRecruiting = openToRecruiting;
        world.profiles.updatedAt.set(u.id, new Date().toISOString());
      }
      return settingsFor(world, u);
    },
  );
};
