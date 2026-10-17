import { useSyncExternalStore } from 'react';
import type {
  AthleteSearchQuery,
  CardFace,
  Division,
  RecruiterList,
  Region,
} from '@team-impact/contracts';
import { colors } from '@team-impact/ui-tokens';
import { api, ApiRequestError } from '@/api';

/**
 * Quick review state the recruiter keeps while they use the app: the deck's filters and the list a
 * right swipe saves to. One small module store, so the review deck, the filters screen and the
 * Lists tab all read and change the same values (a list's "Save my swipes here" sets the target).
 * It lasts the app session; nothing is stored on the device.
 */
export type ReviewFilters = {
  region?: Region;
  division?: Division;
  sport?: string;
  major?: string;
  /** As typed; sent as a number. */
  classYear?: string;
  city?: string;
  experience?: string;
  /** Identity search: an official interest community, only while the flag is on. */
  community?: { id: string; name: string };
};

/** Null means the default "Saved" list, created on the first right swipe if it doesn't exist. */
export type SaveTarget = { id: string; name: string } | null;

type ReviewState = { filters: ReviewFilters; target: SaveTarget };

let state: ReviewState = { filters: {}, target: null };
const listeners = new Set<() => void>();
const set = (next: Partial<ReviewState>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => state;

export function useReviewState() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
export const setReviewFilters = (filters: ReviewFilters) => set({ filters });
export const setSaveTarget = (target: SaveTarget) => set({ target });

export const DEFAULT_LIST_NAME = 'Saved';
export const targetName = (t: SaveTarget) => t?.name ?? DEFAULT_LIST_NAME;

/** Colours a recruiter can tag a list with: token values, stored on the list as hex. */
export const LIST_COLORS = [
  { label: 'Navy', value: colors.brand },
  { label: 'Red', value: colors.action },
  { label: 'Purple', value: colors.role.parent },
  { label: 'Green', value: colors.role.recruiter },
  { label: 'Teal', value: colors.role.alumni },
  { label: 'Black', value: colors.role.coach },
] as const;

export const REGION_NAME: Record<Region, string> = {
  northeast: 'Northeast',
  midwest: 'Midwest',
  south: 'South',
  west: 'West',
};

/** How many cards one deck loads (the API's page cap). */
const DECK_SIZE = 100;

export const toSearchQuery = (f: ReviewFilters): AthleteSearchQuery => {
  const year = Number(f.classYear);
  return {
    limit: DECK_SIZE,
    region: f.region,
    division: f.division,
    sport: f.sport,
    major: f.major,
    classYear: f.classYear && Number.isInteger(year) ? year : undefined,
    city: f.city,
    experience: f.experience,
    communityId: f.community?.id,
  };
};

/** Short labels for the filters in use, for the pills above the deck. */
export const filterLabels = (f: ReviewFilters): string[] =>
  [
    f.region && REGION_NAME[f.region],
    f.division && `Division ${f.division}`,
    f.sport,
    f.major,
    f.classYear && `Class of ${f.classYear}`,
    f.city,
    f.experience && `Experience: ${f.experience}`,
    f.community && f.community.name,
  ].filter((x): x is string => !!x);

export const fullName = (c: { firstName: string; lastName: string }) =>
  `${c.firstName} ${c.lastName}`;

/** "Midfield · Women’s Soccer · Tufts", leaving out blank parts. */
export const cardLine = (c: CardFace) =>
  [c.position, c.team?.name, c.team?.college.name].filter(Boolean).join(' · ') || 'Alumni';

/** The list a save goes to: the chosen one if it still exists, else "Saved", made if missing. */
const resolveTarget = async (): Promise<RecruiterList> => {
  const lists = await api.lists();
  const chosen = state.target && lists.find((l) => l.id === state.target!.id);
  if (chosen) return chosen;
  if (state.target) setSaveTarget(null); // deleted or unshared since it was picked
  const saved = lists.find((l) => l.name.toLowerCase() === DEFAULT_LIST_NAME.toLowerCase());
  return saved ?? api.createList({ name: DEFAULT_LIST_NAME, color: LIST_COLORS[0].value });
};

export type SaveResult = {
  list: string;
  listId: string;
  already: boolean;
  /** Athletes on the list after this save (as far as this device knows). */
  count: number;
};

/** A right swipe or Save: put the athlete on the target list. Already there is not an error. */
export const saveToTarget = async (athleteId: string): Promise<SaveResult> => {
  const list = await resolveTarget();
  try {
    await api.addToList(list.id, athleteId);
    return { list: list.name, listId: list.id, already: false, count: list.athleteCount + 1 };
  } catch (e) {
    if (e instanceof ApiRequestError && e.status === 409)
      return { list: list.name, listId: list.id, already: true, count: list.athleteCount };
    throw e;
  }
};
