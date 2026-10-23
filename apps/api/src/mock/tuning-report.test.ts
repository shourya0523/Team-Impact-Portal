import { describe, expect, it } from 'vitest';
import { PILOT_RANKING } from './feed';
import { tuningWorld } from './tuning';
import {
  hoursAboveQuiet,
  median,
  labelOf,
  overlap,
  SWEEP,
  sweepReport,
  targetResults,
  teamLeadHours,
  PERSONAS,
  tuningReport,
  VARIANTS,
} from './tuning-report';

describe('tuning report: helpers', () => {
  it('takes the median of odd and even lists', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNaN();
  });

  it('measures how much of a list survives', () => {
    expect(overlap(['a', 'b'], ['b', 'a'])).toBe(1);
    expect(overlap(['a', 'b', 'c', 'd'], ['a', 'c', 'x', 'y'])).toBe(0.5);
    expect(overlap([], ['a'])).toBe(1);
  });

  it('works out how long engagement keeps a post above a brand-new quiet one', () => {
    // Engagement 4 is two doublings: two half-lives.
    const log = { halfLifeHours: 24, commentWeight: 2, damping: 'log' as const };
    expect(hoursAboveQuiet(log, Math.exp(3) - 1, 0)).toBeCloseTo(48, 6);
    const sqrt = { ...log, damping: 'sqrt' as const };
    expect(hoursAboveQuiet(sqrt, 9, 0)).toBeCloseTo(48, 6);
    // A comment counts as two rallies.
    expect(hoursAboveQuiet(sqrt, 5, 2)).toBeCloseTo(48, 6);
    expect(hoursAboveQuiet(log, 0, 0)).toBe(0);
  });

  it('works out how long the team weight keeps a quiet team post ahead', () => {
    const params = { ...PILOT_RANKING, communityWeight: { team: 4, interest: 1 } };
    expect(teamLeadHours({ ...params, halfLifeHours: 24 })).toBeCloseTo(48, 6);
    expect(teamLeadHours({ ...params, communityWeight: {} })).toBe(0);
  });
});

describe('tuning report', () => {
  const variants = [VARIANTS[0]!, VARIANTS[2]!];
  const report = tuningReport(variants);

  it('covers every formula and persona, with the summary first', () => {
    expect(report.startsWith('# Feed ranking: tuning report')).toBe(true);
    for (const v of variants) {
      expect(report).toContain(`| ${v.label} |`);
      expect(report).toContain(`## ${v.label}`);
    }
    for (const { label } of PERSONAS) {
      expect(report.split(`### ${label}`)).toHaveLength(variants.length + 1);
    }
  });

  it('reports the team share of every persona’s top 10', () => {
    expect(report.split('Team share of the top 10:')).toHaveLength(
      variants.length * PERSONAS.length + 1,
    );
  });

  it('leaves every other world on the default ranking', () => {
    expect(tuningWorld().ranking).toEqual(PILOT_RANKING);
  });
});

describe('the pilot ranking against the agreed targets', () => {
  const failures = (results: ReturnType<typeof targetResults>) =>
    results
      .filter((r) => !r.pass)
      .map((r) => `${r.target}${r.persona ? ` (${r.persona})` : ''}: ${r.value}`);

  it('meets every target, for every persona it applies to', () => {
    const results = targetResults(PILOT_RANKING);
    expect(results.length).toBeGreaterThanOrEqual(15);
    expect(failures(results)).toEqual([]);
  });

  it('would catch a team-heavy, slow-decaying formula', () => {
    const heavy = {
      ...PILOT_RANKING,
      halfLifeHours: 48,
      communityWeight: { ...PILOT_RANKING.communityWeight, team: 6 },
    };
    const missed = failures(targetResults(heavy)).join('\n');
    expect(missed).toContain('team post leads');
    expect(missed).toContain('team share of top 10');
    expect(missed).toContain('VIRAL beats');
  });

  it('sweeps the whole grid, with the pilot ranking meeting every target there too', () => {
    const sweep = sweepReport();
    const rows = sweep.split('\n').filter((line) => /^\| \d+ \|/.test(line));
    const size =
      SWEEP.halfLifeHours.length *
      SWEEP.team.length *
      SWEEP.damping.length *
      SWEEP.commentWeight.length;
    expect(rows).toHaveLength(size);
    const pilot = rows.find((line) => line.includes(`| ${labelOf(PILOT_RANKING)} |`))!;
    const [met, total] = pilot.split('|')[3]!.trim().split('/');
    expect(met).toBe(total);
  });
});
