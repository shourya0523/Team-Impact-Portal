import type { Post } from '@team-impact/contracts';
import { heuristic, type HeuristicParams, PILOT_RANKING } from './feed';
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

const blended = (
  halfLifeHours: number,
  team: number,
  damping: 'log' | 'sqrt' = 'log',
): HeuristicParams => ({
  halfLifeHours,
  commentWeight: 2,
  damping,
  communityWeight: { team, interest: 1.5, medical: 1.5, team_impact: 1 },
});

/** A label that names a formula's settings. */
export const labelOf = (r: HeuristicParams) =>
  `${r.halfLifeHours}h, ${r.damping}, comment ×${r.commentWeight}, team ×${
    r.communityWeight?.team ?? 1
  }`;

/** The formulas compared when no settings are given on the command line. */
export const VARIANTS: Variant[] = [
  { label: 'newest first, every community alike', ranking: null },
  { label: `${labelOf(PILOT_RANKING)} (default)`, ranking: PILOT_RANKING },
  ...[blended(24, 2), blended(24, 3), blended(24, 6), blended(48, 4), blended(12, 4)].map(
    (ranking) => ({ label: labelOf(ranking), ranking }),
  ),
  ...[blended(24, 4, 'sqrt')].map((ranking) => ({ label: labelOf(ranking), ranking })),
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

/**
 * How long a quiet team post stays above an equally quiet post in an interest community: the
 * team's extra weight buys `halfLife × log₂(team weight / interest weight)` hours of recency.
 */
export const teamLeadHours = (params: HeuristicParams) =>
  params.halfLifeHours *
  Math.log2((params.communityWeight?.team ?? 1) / (params.communityWeight?.interest ?? 1));

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
  teamShare: number;
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
    teamShare: feed.slice(0, 10).filter((p) => p.community.kind === 'team').length / 10,
  };
  return { w, feed, top, measures, perHour };
};

const cell = (n: number | null) => (n === null ? 'not in feed' : `#${n}`);
const percent = (share: number) => `${Math.round(share * 100)}%`;

const topTable = (w: MockWorld, ranking: HeuristicParams | null, top: Post[]) => [
  '| # | Kind | Community | Age | Rallies | Comments | Score | Post |',
  '|---|---|---|---|---|---|---|---|',
  ...top.map(
    (p, i) =>
      `| ${i + 1} | ${p.community.kind} | ${p.community.name} | ${formatAge(
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
    `Tuning world (\`src/mock/tuning.ts\`), scored as of ${TUNING_NOW}. No hard tiers: each`,
    'community kind has a weight, and "team first" comes from the team weight. "Team post leads"',
    'is how long a quiet team post stays above an equally quiet interest post.',
    '',
    '## Summary (Jordan)',
    '',
    '| Formula | Median age, top 20 | Communities in top 10 | Team share of top 10 | Team post leads | VIRAL | VIRAL beats a new quiet post for | QUIET | Top 10 kept after an hour |',
    '|---|---|---|---|---|---|---|---|---|',
  ];
  const details: string[] = [];

  for (const variant of variants) {
    const jordan = measure(variant, USERS.jordan).measures;
    const hours = (n: number) => `${Math.round(n)}h`;
    const viralHours = variant.ranking ? hours(hoursAboveQuiet(variant.ranking, 80, 25)) : '0h';
    const teamLead = variant.ranking ? hours(teamLeadHours(variant.ranking)) : '0h';
    lines.push(
      `| ${variant.label} | ${formatAge(jordan.freshness)} | ${jordan.variety} | ${percent(jordan.teamShare)} | ${teamLead} | ${cell(jordan.viral)} | ${viralHours} | ${cell(jordan.quiet)} | ${percent(jordan.churn)} |`,
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
          `${percent(measures.churn)}. Team share of the top 10: ${percent(measures.teamShare)}.`,
        '',
        ...topTable(w, variant.ranking, top),
        '',
      );
    }
  }
  return [...lines, '', ...details].join('\n');
};

// Targets and the sweep (step 6: agreed before looking at results).

export interface TargetResult {
  target: string;
  /** Empty for targets about the formula itself rather than one persona's feed. */
  persona: string;
  value: string;
  pass: boolean;
}

/**
 * Every agreed target, checked against the tuning world. Per persona where it applies: team share
 * only for people on a team, variety only for people in 4 or more communities, QUIET only for its
 * members. Freshness is measured against plain newest first, the freshest feed the data allows
 * (some personas simply have no day's worth of posts).
 */
export const targetResults = (ranking: HeuristicParams): TargetResult[] => {
  const results: TargetResult[] = [];
  const add = (target: string, persona: string, value: string, pass: boolean) =>
    results.push({ target, persona, value, pass });
  const variant = { label: labelOf(ranking), ranking };

  const lead = teamLeadHours(ranking);
  add('team post leads 12–48h', '', `${Math.round(lead)}h`, lead >= 12 && lead <= 48);
  const viral = hoursAboveQuiet(ranking, 80, 25);
  add('VIRAL beats a new quiet post ≤ 72h', '', `${Math.round(viral)}h`, viral <= 72);

  for (const { label, user } of PERSONAS) {
    const name = label.split(' (')[0]!;
    const { feed, measures } = measure(variant, user);
    const kinds = new Set(feed.map((p) => p.community.id));
    if (feed.some((p) => p.community.kind === 'team')) {
      const share = measures.teamShare;
      add('team share of top 10 50–80%', name, percent(share), share >= 0.5 && share <= 0.8);
    }
    if (kinds.size >= 4) {
      add('≥ 3 communities in top 10', name, String(measures.variety), measures.variety >= 3);
    }
    const freshest = measure({ label: 'newest first', ranking: null }, user).measures.freshness;
    add(
      'median age of top 20 ≤ newest first + 12h',
      name,
      `${formatAge(measures.freshness)} vs ${formatAge(freshest)}`,
      measures.freshness <= freshest + 12,
    );
    if (measures.quiet !== null) {
      add('QUIET on page 1', name, cell(measures.quiet), measures.quiet <= TOP);
    }
    add('top 10 kept after an hour ≥ 80%', name, percent(measures.churn), measures.churn >= 0.8);
  }
  return results;
};

/** The sweep grid: every combination is tried. */
export const SWEEP = {
  halfLifeHours: [12, 18, 24, 36, 48],
  team: [2, 2.5, 3, 4],
  damping: ['log', 'sqrt'] as const,
  commentWeight: [1, 2, 3],
};

/**
 * One row per setting in the grid, most targets met first; among ties, the team share closest to
 * the middle of its range (65%), averaged over personas, since that's the main trade-off.
 */
export const sweepReport = () => {
  const rows = SWEEP.halfLifeHours.flatMap((halfLifeHours) =>
    SWEEP.team.flatMap((team) =>
      SWEEP.damping.flatMap((damping) =>
        SWEEP.commentWeight.map((commentWeight) => {
          const ranking: HeuristicParams = {
            ...PILOT_RANKING,
            halfLifeHours,
            commentWeight,
            damping,
            communityWeight: { ...PILOT_RANKING.communityWeight, team },
          };
          const results = targetResults(ranking);
          const shares = results
            .filter((r) => r.target.startsWith('team share'))
            .map((r) => Number(r.value.replace('%', '')) / 100);
          return {
            ranking,
            met: results.filter((r) => r.pass).length,
            total: results.length,
            balance: shares.reduce((sum, s) => sum + Math.abs(s - 0.65), 0) / shares.length,
            misses: results.filter((r) => !r.pass),
          };
        }),
      ),
    ),
  );
  rows.sort((a, b) => b.met - a.met || a.balance - b.balance);
  return [
    '# Feed ranking: sweep',
    '',
    `${rows.length} settings against the agreed targets (\`targetResults\` in`,
    '`src/mock/tuning-report.ts`). Most targets met first; ties by team share nearest 65%.',
    '',
    '| # | Settings | Targets met | Misses |',
    '|---|---|---|---|',
    ...rows.map(
      (r, i) =>
        `| ${i + 1} | ${labelOf(r.ranking)} | ${r.met}/${r.total} | ${
          r.misses
            .map((m) => `${m.target}${m.persona ? ` (${m.persona}: ${m.value})` : ` (${m.value})`}`)
            .join('; ') || '–'
        } |`,
    ),
  ].join('\n');
};
