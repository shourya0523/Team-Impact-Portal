import { z } from 'zod';
import { CardFace } from './cards';
import { Timestamp, Token } from './common';
import { MyCardState } from './profiles';

/**
 * Claiming a pre-built Baseball Card (PRD L5). Team Impact builds a card for an alumni athlete from
 * their public LinkedIn profile and emails them a personal link. Until it is claimed the card exists
 * for nobody: it is never in search, profiles, lists, exports or `/cards/*`. Only the link's holder
 * can open it, signed in as an alumni athlete, and each link works once.
 *
 * Claiming publishes nothing. LinkedIn text is untrusted, like a resume: the card's fields wait for
 * the alumnus to accept them one by one in the card review, then go into an unpublished draft.
 */
export const CardClaimParams = z.object({ token: Token });
export type CardClaimParams = z.infer<typeof CardClaimParams>;

/** The pre-built face: who it's for by first name only, with no ids and no last name. */
export const PrebuiltCardFace = CardFace.omit({ id: true, athleteId: true, lastName: true });
export type PrebuiltCardFace = z.infer<typeof PrebuiltCardFace>;

/** What the link's holder sees before claiming. */
export const CardClaimPreview = z.object({
  source: z.literal('linkedin'),
  face: PrebuiltCardFace,
  expiresAt: Timestamp,
});
export type CardClaimPreview = z.infer<typeof CardClaimPreview>;

/** After claiming: the card waits in `card.pendingResume` (source `prebuilt`) for review. */
export const CardClaimResult = z.object({
  claimedAt: Timestamp,
  card: MyCardState,
});
export type CardClaimResult = z.infer<typeof CardClaimResult>;
