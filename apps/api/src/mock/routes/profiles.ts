import { z } from 'zod';
import {
  canBeOpenToRecruiting,
  ChildProfile,
  ConsentHistory,
  consentFlags,
  type ContactSharing,
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
        // Each sharing choice that changes is a consent record; contact values are not.
        const share = (
          current: ContactSharing,
          next: Partial<ContactSharing> | undefined,
          flag: (channel: keyof ContactSharing) => string,
        ) => {
          for (const channel of ['email', 'phone', 'linkedin'] as const) {
            const on = next?.[channel];
            if (on !== undefined && on !== current[channel]) {
              world.recordConsent(u.id, flag(channel), on);
              current[channel] = on;
            }
          }
        };
        if (contact) Object.assign(card.contact, contact);
        share(card.visibility.familiesSee, familiesSee, consentFlags.familiesSee);
        share(card.visibility.recruitersSee, recruitersSee, consentFlags.recruitersSee);
        if (
          openToRecruiting !== undefined &&
          openToRecruiting !== card.visibility.openToRecruiting
        ) {
          world.recordConsent(u.id, consentFlags.openToRecruiting, openToRecruiting);
          card.visibility.openToRecruiting = openToRecruiting;
        }
        world.profiles.updatedAt.set(u.id, new Date().toISOString());
      }
      return settingsFor(world, u);
    },
  );

  /** The signed-in user's consent history: every privacy choice they made, newest first. */
  app.get(
    '/me/consent-history',
    { schema: { response: { 200: ConsentHistory } } },
    async (request) => {
      const u = viewer(request);
      return world.consentRecords
        .filter((r) => r.userId === u.id)
        .map(({ flag, value, recordedAt }) => ({ flag, value, recordedAt }))
        .reverse();
    },
  );
};
