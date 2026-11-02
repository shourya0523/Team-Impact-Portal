import { describe, expect, it } from 'vitest';
import { SPORTS } from '@team-impact/contracts';
import { isReadableTeamColor } from '@team-impact/ui-tokens';
import { COLLEGES, SPORTS as SEEDED_SPORTS, TEAM_COLORS } from './data';

describe('seed reference data', () => {
  it('seeds Tufts University, and every college under one name', () => {
    const names = COLLEGES.map((c) => c.name);
    expect(names).toContain('Tufts University');
    const folded = names.map((n) => n.trim().toLowerCase());
    expect(new Set(folded).size).toBe(names.length);
  });

  it('seeds teams only in sports staff can pick from', () => {
    for (const sport of Object.keys(SEEDED_SPORTS)) {
      expect(SPORTS as readonly string[], sport).toContain(sport);
    }
  });

  it('seeds only team colours that white or ink text can be read on', () => {
    for (const color of TEAM_COLORS) expect(isReadableTeamColor(color), color).toBe(true);
  });
});
