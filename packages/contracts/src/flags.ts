import { z } from 'zod';

/**
 * Switches the clients read at start-up. Each hides a whole feature at once, so a "no" from
 * counsel (PRD §11) is a config change, not a release.
 */
export const FeatureFlags = z.object({
  /** Recruiters filtering by official community (PRD §7). Off hides the filter; search still works. */
  identitySearch: z.boolean(),
  /** The medical community kind, everywhere: lists, feed, search, creation (PRD §5). */
  medicalCommunities: z.boolean(),
});
export type FeatureFlags = z.infer<typeof FeatureFlags>;
