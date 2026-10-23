import { parseArgs } from 'node:util';
import type { HeuristicParams } from './feed';
import { tuningReport, VARIANTS } from './tuning-report';

/**
 * Prints the feed tuning report as markdown (`./tuning-report.ts`).
 *
 *   pnpm --filter @team-impact/api feed:tune                  # the built-in formulas
 *   pnpm --filter @team-impact/api feed:tune --half-life 36 --comment-weight 3 --damping sqrt
 *   pnpm --filter @team-impact/api feed:tune > report.md      # save it
 *
 * With settings, it compares that one formula against newest first.
 */
const { values } = parseArgs({
  options: {
    'half-life': { type: 'string' },
    'comment-weight': { type: 'string' },
    damping: { type: 'string' },
  },
});

const custom = (): HeuristicParams | null => {
  if (!values['half-life'] && !values['comment-weight'] && !values.damping) return null;
  const halfLifeHours = Number(values['half-life'] ?? 24);
  const commentWeight = Number(values['comment-weight'] ?? 2);
  const damping = values.damping ?? 'log';
  if (!(halfLifeHours > 0) || !(commentWeight >= 0) || (damping !== 'log' && damping !== 'sqrt')) {
    console.error(
      'Use --half-life <hours above 0> --comment-weight <0 or more> --damping log|sqrt',
    );
    process.exit(1);
  }
  return { halfLifeHours, commentWeight, damping };
};

const ranking = custom();
console.log(
  tuningReport(
    ranking
      ? [
          VARIANTS[0]!,
          {
            label: `${ranking.halfLifeHours}h, ${ranking.damping}, comment ×${ranking.commentWeight}`,
            ranking,
          },
        ]
      : VARIANTS,
  ),
);
