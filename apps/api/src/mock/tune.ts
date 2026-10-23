import { parseArgs } from 'node:util';
import { type HeuristicParams, PILOT_RANKING } from './feed';
import { labelOf, tuningReport, VARIANTS } from './tuning-report';

/**
 * Prints the feed tuning report as markdown (`./tuning-report.ts`).
 *
 *   pnpm --filter @team-impact/api feed:tune                  # the built-in formulas
 *   pnpm --filter @team-impact/api feed:tune --half-life 36 --team-weight 3 --damping sqrt
 *   pnpm --filter @team-impact/api feed:tune > report.md      # save it
 *
 * Settings start from the default (`PILOT_RANKING`); the report then compares newest first, the
 * default, and yours.
 */
const { values } = parseArgs({
  options: {
    'half-life': { type: 'string' },
    'comment-weight': { type: 'string' },
    'team-weight': { type: 'string' },
    damping: { type: 'string' },
  },
});

const custom = (): HeuristicParams | null => {
  if (Object.values(values).every((v) => v === undefined)) return null;
  const halfLifeHours = Number(values['half-life'] ?? PILOT_RANKING.halfLifeHours);
  const commentWeight = Number(values['comment-weight'] ?? PILOT_RANKING.commentWeight);
  const team = Number(values['team-weight'] ?? PILOT_RANKING.communityWeight?.team ?? 1);
  const damping = values.damping ?? PILOT_RANKING.damping;
  if (
    !(halfLifeHours > 0) ||
    !(commentWeight >= 0) ||
    !(team > 0) ||
    (damping !== 'log' && damping !== 'sqrt')
  ) {
    console.error(
      'Use --half-life <hours above 0> --comment-weight <0 or more> --team-weight <above 0> ' +
        '--damping log|sqrt',
    );
    process.exit(1);
  }
  return {
    ...PILOT_RANKING,
    halfLifeHours,
    commentWeight,
    damping,
    communityWeight: { ...PILOT_RANKING.communityWeight, team },
  };
};

const ranking = custom();
console.log(
  tuningReport(
    ranking ? [VARIANTS[0]!, VARIANTS[1]!, { label: labelOf(ranking), ranking }] : VARIANTS,
  ),
);
