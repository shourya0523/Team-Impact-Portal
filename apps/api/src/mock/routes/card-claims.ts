import {
  CardClaimParams,
  CardClaimPreview,
  CardClaimResult,
  CardFields,
  EXTRACTABLE_CARD_FIELDS,
  type ResumeExtraction,
} from '@team-impact/contracts';
import type { FastifyRequest } from 'fastify';
import type { ZodApp } from '../../zod';
import type { MockPrebuiltCard } from '../fixtures';
import { myCardState } from '../profiles';
import type { MockWorld } from '../world';
import { httpError, type Guards } from './context';

/**
 * Claiming a pre-built Baseball Card from a personal invite link (PRD L5). Rules:
 * - the card lives only in `world.prebuiltCards`, never in `world.cards`, so until it's claimed it
 *   is in no search, profile, list, export or `/cards/*` response;
 * - only the link's holder, signed in as an alumni athlete, can preview or claim it (other roles get
 *   403 before the token is even looked at, so a forwarded link shows them nothing);
 * - each link works once and only until it expires (404 unknown, 410 used or expired), and an
 *   account claims at most one card;
 * - claiming publishes nothing: the fields go to the claimant's card review, like a resume they
 *   uploaded, and only what they accept reaches their (unpublished) draft.
 */
export const registerCardClaimRoutes = (app: ZodApp, world: MockWorld, { requireRole }: Guards) => {
  const claimant = (request: FastifyRequest) => requireRole(request, 'alumni_athlete');

  const open = (token: string, now = Date.now()): MockPrebuiltCard => {
    const card = world.prebuiltCards.find((c) => c.token === token);
    if (!card) throw httpError(404, 'No such card invite');
    if (card.claimedAt) throw httpError(410, 'This card has already been claimed');
    if (Date.parse(card.expiresAt) <= now) {
      throw httpError(410, 'This invite has expired. Ask Team Impact to resend it');
    }
    return card;
  };

  app.get(
    '/card-claims/:token',
    { schema: { params: CardClaimParams, response: { 200: CardClaimPreview } } },
    async (request) => {
      claimant(request);
      const card = open(request.params.token);
      const { lastName, ...face } = card.face;
      void lastName;
      return {
        source: 'linkedin' as const,
        face: { ...face, team: null },
        expiresAt: card.expiresAt,
      };
    },
  );

  app.post(
    '/card-claims/:token/claim',
    { schema: { params: CardClaimParams, response: { 200: CardClaimResult } } },
    async (request) => {
      const u = claimant(request);
      const card = open(request.params.token);
      if (world.prebuiltCards.some((c) => c.claimedById === u.id)) {
        throw httpError(409, 'You’ve already claimed a pre-built card');
      }
      const now = new Date().toISOString();
      card.claimedById = u.id;
      card.claimedAt = now;

      // LinkedIn text is untrusted: only fields that fit the card's schema go to review.
      const fields: Record<string, unknown> = {};
      for (const key of EXTRACTABLE_CARD_FIELDS) {
        const value = card.face[key];
        if (value === null || (Array.isArray(value) && value.length === 0)) continue;
        const ok = CardFields.shape[key].safeParse(value);
        if (ok.success) fields[key] = ok.data;
      }
      const keys = EXTRACTABLE_CARD_FIELDS.filter((k) => k in fields);
      const review: ResumeExtraction = {
        id: world.newId(),
        status: 'unconfirmed',
        source: 'prebuilt',
        fileName: 'LinkedIn profile',
        failed: keys.length === 0,
        fields: fields as ResumeExtraction['fields'],
        needsReview: [...keys],
        createdAt: now,
      };
      world.profiles.resumes.set(u.id, review);
      return { claimedAt: now, card: myCardState(world, u) };
    },
  );
};
