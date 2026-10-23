import type { Post } from '@team-impact/contracts';
import { heuristic, type HeuristicParams, TIER } from './feed';
import { COMMUNITIES, id, type MockPost, type MockUser, USERS } from './fixtures';
import { TUNING, TUNING_NOW, tuningWorld } from './tuning';
import type { MockWorld } from './world';

/**
 * Builds the feed tuning report (`pnpm --filter @team-impact/api feed:tune`): for each formula and
 * persona, the top of the feed and a few measurements, as markdown to read or paste. It never
 * changes the app's ranking; every formula gets its own fresh tuning world.
 */

export interface Variant {
  label: string;
  /** null is newest first, today's default. */
  ranking: HeuristicParams | null;
}

/** The formulas compared when no settings are given on the command line. */
export const VARIANTS: Variant[] = [
  { label: 'newest first (today)', ranking: null },
  {
    label: '12h, log, comment ×2',
    ranking: { halfLifeHours: 12, commentWeight: 2, damping: 'log' },
  },
  {
    label: '24h, log, comment ×2',
    ranking: { halfLifeHours: 24, commentWeight: 2, damping: 'log' },
  },
  {
    label: '48h, log, comment ×2',
    ranking: { halfLifeHours: 48, commentWeight: 2, damping: 'log' },
  },
  {
    label: '24h, sqrt, comment ×2',
    ranking: { halfLifeHours: 24, commentWeight: 2, damping: 'sqrt' },
  },
  {
    label: '48h, sqrt, comment ×2',
    ranking: { halfLifeHours: 48, commentWeight: 2, damping: 'sqrt' },
  },
];

export const PERSONAS: { label: string; user: MockUser }[] = [
  { label: 'Jordan (athlete: team, private, medical, First Gen)', user: USERS.jordan },
  { label: 'Lisa (parent on two teams, medical)', user: USERS.lisa },
  { label: 'Noah (teen)', user: USERS.noah },
  { label: 'Dana (coach)', user: USERS.coach },
  { label: 'Elena (recruiter)', user: USERS.elena },
];

const TOP = 20;
const HOUR = 3_600_000;
const STARS: Record<string, string> = {
  [TUNING.VIRAL]: '★ VIRAL',
  [TUNING.QUIET]: '★ QUIET',
  ...Object.fromEntries(TUNING.GAME_DAY.map((id) => [id, '★ GAME DAY'])),
  ...Object.fromEntries(TUNING.ANNOUNCEMENT_DAY.map((id) => [id, '★ ANNOUNCEMENT'])),
};

// Small helpers, exported for their tests.

export const median = (values: number[]) => {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

/** Share of `before` still present in `after` (1 when nothing left the list). */
export const overlap = (before: string[], after: string[]) => {
  if (before.length === 0) return 1;
  const kept = new Set(after);
  return before.filter((id) => kept.has(id)).length / before.length;
};

/**
 * How many hours a post with this much activity stays above a brand-new post with none, under
 * `params`: its engagement buys `halfLife × log₂(engagement)` hours of recency. Worked out from
 * the formula itself (two posts of the same age, so recency and weight cancel).
 */
export const hoursAboveQuiet = (params: HeuristicParams, rallies: number, comments: number) => {
  const c = COMMUNITIES.find((x) => x.kind === 'interest')!;
  const post = (likeCount: number): MockPost => ({
    id: id(1),
    kind: 'post',
    authorId: id(1),
    communityId: c.id,
    text: '',
    official: false,
    likeCount,
    commentCount: 0,
    moderation: 'approved',
    createdAt: TUNING_NOW,
  });
  const busy = heuristic(params, () => comments)(post(rallies), c, TUNING_NOW);
  const quiet = heuristic(params, () => 0)(post(0), c, TUNING_NOW);
  return params.halfLifeHours * Math.log2(busy / quiet);
};

const ageOf = (createdAt: string, asOf = TUNING_NOW) =>
  (Date.parse(asOf) - Date.parse(createdAt)) / HOUR;

const formatAge = (hours: number) =>
  hours < 24 ? `${Math.round(hours)}h` : `${Math.floor(hours / 24)}d ${Math.round(hours % 24)}h`;

const position = (feed: Post[], id: string) => {
  const i = feed.findIndex((p) => p.id === id);
  return i === -1 ? null : i + 1;
};

/** The score a post got, for the table (newest first has no score worth showing). */
const scoreOf = (w: MockWorld, ranking: HeuristicParams | null, p: Post) => {
  if (!ranking) return '–';
  const stored = w.posts.find((x) => x.id === p.id)!;
  const c = w.communities.find((x) => x.id === p.community.id)!;
  return heuristic(ranking, () => p.commentCount)(stored, c, TUNING_NOW).toFixed(3);
};

/** Tiers only ever go up the feed: team, then other communities, then Team Impact. */
const tiersHold = (feed: Post[]) =>
  feed.every((p, i) => i === 0 || TIER[feed[i - 1]!.community.kind] <= TIER[p.community.kind]);

/**
 * An hour of typical new posts: as many as the tuning world gets in an average hour of its last
 * day, in the communities those recent posts were in, with no engagement yet.
 */
const withAnHourOfArrivals = (w: MockWorld) => {
  const recent = w.posts
    .filter(
      (p) => p.moderation === 'approved' && ageOf(p.createdAt) <= 24 && ageOf(p.createdAt) >= 0,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const perHour = Math.max(1, Math.round(recent.length / 24));
  const later = new Date(Date.parse(TUNING_NOW) + HOUR).toISOString();
  recent.slice(0, perHour).forEach((p, i) => {
    w.posts.push({
      ...p,
      id: id(90000 + i),
      text: 'New this hour',
      likeCount: 0,
      createdAt: new Date(Date.parse(TUNING_NOW) + ((i + 1) * HOUR) / (perHour + 1)).toISOString(),
    });
  });
  return { later, perHour };
};

interface Measures {
  freshness: number;
  variety: number;
  viral: number | null;
  quiet: number | null;
  churn: number;
  tiers: boolean;
}

const measure = (variant: Variant, user: MockUser) => {
  const w = tuningWorld();
  w.ranking = variant.ranking;
  const feed = w.feed(user, TUNING_NOW);
  const top = feed.slice(0, TOP);

  const after = tuningWorld();
  after.ranking = variant.ranking;
  const { later, perHour } = withAnHourOfArrivals(after);
  const topTenLater = after.feed(user, later).slice(0, 10);

  const measures: Measures = {
    freshness: median(top.map((p) => ageOf(p.createdAt))),
    variety: new Set(feed.slice(0, 10).map((p) => p.community.id)).size,
    viral: position(feed, TUNING.VIRAL),
    quiet: position(feed, TUNING.QUIET),
    churn: overlap(
      feed.slice(0, 10).map((p) => p.id),
      topTenLater.map((p) => p.id),
    ),
    tiers: tiersHold(feed),
  };
  return { w, feed, top, measures, perHour };
};

const cell = (n: number | null) => (n === null ? 'not in feed' : `#${n}`);
const percent = (share: number) => `${Math.round(share * 100)}%`;

const topTable = (w: MockWorld, ranking: HeuristicParams | null, top: Post[]) => [
  '| # | Tier | Community | Age | Rallies | Comments | Score | Post |',
  '|---|---|---|---|---|---|---|---|',
  ...top.map(
    (p, i) =>
      `| ${i + 1} | ${TIER[p.community.kind]} | ${p.community.name} | ${formatAge(
        ageOf(p.createdAt),
      )} | ${p.likeCount} | ${p.commentCount} | ${scoreOf(w, ranking, p)} | ${
        STARS[p.id] ? `${STARS[p.id]}: ` : ''
      }${p.text.replace(/\|/g, '/')} |`,
  ),
];

/** The whole report, as markdown. */
export const tuningReport = (variants: Variant[] = VARIANTS) => {
  const lines: string[] = [
    '# Feed ranking: tuning report',
    '',
    `Tuning world (\`src/mock/tuning.ts\`), scored as of ${TUNING_NOW}. Tiers come first in every`,
    'formula (team 0, other communities 1, Team Impact 2); the score only orders posts within a tier.',
    '',
    '## Summary (Jordan)',
    '',
    '| Formula | Median age, top 20 | Communities in top 10 | VIRAL | VIRAL beats a new quiet post for | QUIET | Top 10 kept after an hour | Tiers hold |',
    '|---|---|---|---|---|---|---|---|',
  ];
  const details: string[] = [];

  for (const variant of variants) {
    const jordan = measure(variant, USERS.jordan).measures;
    const viralHours = variant.ranking
      ? `${Math.round(hoursAboveQuiet(variant.ranking, 80, 25))}h`
      : '0h';
    lines.push(
      `| ${variant.label} | ${formatAge(jordan.freshness)} | ${jordan.variety} | ${cell(jordan.viral)} | ${viralHours} | ${cell(jordan.quiet)} | ${percent(jordan.churn)} | ${jordan.tiers ? 'yes' : '**NO**'} |`,
    );

    details.push(`## ${variant.label}`, '');
    if (variant.ranking) details.push(`Settings: \`${JSON.stringify(variant.ranking)}\``, '');
    for (const { label, user } of PERSONAS) {
      const { w, feed, top, measures, perHour } = measure(variant, user);
      details.push(
        `### ${label}`,
        '',
        `${feed.length} posts in the feed. Median age of the top ${TOP}: ${formatAge(measures.freshness)}. ` +
          `Communities in the top 10: ${measures.variety}. VIRAL: ${cell(measures.viral)}. ` +
          `QUIET: ${cell(measures.quiet)}. Top 10 kept after an hour (${perHour} new posts): ` +
          `${percent(measures.churn)}. Tiers hold: ${measures.tiers ? 'yes' : '**NO**'}.`,
        '',
        ...topTable(w, variant.ranking, top),
        '',
      );
    }
  }
  return [...lines, '', ...details].join('\n');
};
