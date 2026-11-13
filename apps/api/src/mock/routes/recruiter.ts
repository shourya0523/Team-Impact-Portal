import { z } from 'zod';
import {
  AthleteSearchQuery,
  CardFace,
  CardWithContact,
  IdParams,
  page,
  RecruiterList,
  RecruiterListDetail,
  searchFilters,
  type TrackedEvent,
} from '@team-impact/contracts';
import type { ZodApp } from '../../zod';
import { summaryOf } from '../fixtures';
import type { MockWorld } from '../world';
import { httpError, paginate, type Guards } from './context';

/** Recruiters: athlete search, cards, lists. */
export const registerRecruiterRoutes = (
  app: ZodApp,
  world: MockWorld,
  { viewer, requireRole }: Guards,
) => {
  app.get(
    '/search/athletes',
    { schema: { querystring: AthleteSearchQuery, response: { 200: page(CardFace) } } },
    async (request) => {
      const u = requireRole(request, 'recruiter');
      const q = request.query;
      // Published, open to recruiting, and not across a block with this recruiter.
      let cards = world.cards.filter((card) => world.canReadCard(card, u));
      let identity: { communityId: string; companyId: string } | undefined;

      if (q.communityId) {
        if (!world.flags.identitySearch) throw httpError(400, 'The community filter is off');
        const c = world.communities.find((x) => x.id === q.communityId);
        // Only official interest communities are filters; team and medical ones never are.
        if (!c || c.kind !== 'interest' || !c.official || c.moderation !== 'approved') {
          throw httpError(400, 'Only official communities can be used as filters');
        }
        const findable = new Set(
          c.members.filter((m) => m.recruiterSearchOptIn).map((m) => m.userId),
        );
        cards = cards.filter((card) => findable.has(card.face.athleteId));
        const company = world.companies.find((co) => co.id === u.companyId)!;
        world.identitySearches.push({
          id: world.newId(),
          recruiter: summaryOf(u),
          company: { id: company.id, name: company.name },
          community: { id: c.id, name: c.name },
          searchedAt: new Date().toISOString(),
        });
        identity = { communityId: c.id, companyId: company.id };
      }

      const has = (value: string | null | undefined, wanted?: string) =>
        !wanted || (value ?? '').toLowerCase().includes(wanted.toLowerCase());
      const faces = cards
        .map(world.cardFace)
        .filter(
          (f) =>
            (!q.region || f.region === q.region) &&
            has(f.city, q.city) &&
            has(f.team?.sport, q.sport) &&
            has(f.major, q.major) &&
            (!q.classYear || f.classYear === q.classYear) &&
            (!q.division || f.team?.division === q.division) &&
            has(f.experience.map((e) => `${e.role} ${e.organization}`).join(' '), q.experience),
        );
      const results = paginate(faces, q);

      // The search, then who it showed (PRD §12). An identity search is logged as one, not as both.
      const searchId = world.newId();
      const search = { searchId, filters: searchFilters(q), resultCount: faces.length };
      const events: TrackedEvent[] = [
        identity
          ? { name: 'search.identity_filter', properties: { ...search, ...identity } }
          : { name: 'search.run', properties: { ...search, surface: 'athletes' } },
        ...results.items.map((face, position) => ({
          name: 'search.result_shown' as const,
          subjectId: face.athleteId,
          properties: { searchId, position },
        })),
      ];
      world.track(u.id, events);
      return results;
    },
  );

  app.get(
    '/cards/:id',
    { schema: { params: IdParams, response: { 200: CardWithContact } } },
    async (request) => {
      const card = world.cardFor(request.params.id, viewer(request));
      if (!card) throw httpError(404, 'No such card');
      return card;
    },
  );

  app.get('/lists', { schema: { response: { 200: z.array(RecruiterList) } } }, async (request) => {
    const u = requireRole(request, 'recruiter');
    return world.listsFor(u).map((l) => world.list(l, u));
  });

  app.get(
    '/lists/:id',
    { schema: { params: IdParams, response: { 200: RecruiterListDetail } } },
    async (request) => {
      const u = requireRole(request, 'recruiter');
      const list = world.listsFor(u).find((l) => l.id === request.params.id);
      if (!list) throw httpError(404, 'No such list');
      return world.listDetail(list, u);
    },
  );
};
