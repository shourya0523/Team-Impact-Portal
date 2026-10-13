import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, readableOn, textPairs, uiPairs } from './accessibility';
import { tokensToCss } from './css';
import { colors } from './index';
import { onTeamColor, resolveTeamColor } from './team';

describe('contrast', () => {
  it.each([...textPairs, ...uiPairs])(
    '$name meets its minimum',
    ({ foreground, background, min }) => {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(min);
    },
  );

  it('picks legible text on any team colour', () => {
    for (const c of ['#FFD100', '#0B1F5C', '#E4002B', '#7FDBFF', '#222222']) {
      expect(contrastRatio(readableOn(c), c)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('team colour', () => {
  it('falls back to brand', () => {
    expect(resolveTeamColor(undefined)).toBe(colors.brand);
    expect(resolveTeamColor('red')).toBe(colors.brand);
    expect(resolveTeamColor('#FFD100')).toBe('#FFD100');
    expect(onTeamColor('#FFD100')).toBe(colors.ink);
  });
});

describe('generated css', () => {
  it('tokens.css is up to date (run `pnpm --filter @team-impact/ui-tokens build:css`)', () => {
    const file = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
    expect(file).toBe(tokensToCss());
  });
});
