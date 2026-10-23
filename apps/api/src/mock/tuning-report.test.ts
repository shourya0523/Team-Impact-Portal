import { describe, expect, it } from 'vitest';
import { tuningWorld } from './tuning';
import {
  hoursAboveQuiet,
  median,
  overlap,
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

  it('confirms tiers hold for every persona and formula', () => {
    expect(report).not.toContain('**NO**');
    expect(report.split('Tiers hold: yes')).toHaveLength(variants.length * PERSONAS.length + 1);
  });

  it('leaves every other world on newest first', () => {
    expect(tuningWorld().ranking).toBeNull();
  });
});
