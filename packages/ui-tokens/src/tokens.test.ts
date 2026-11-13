import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, readableOn, textPairs, uiPairs } from './accessibility';
import { tokensToCss } from './css';
import { colors, isReadableTeamColor as fromIndex } from './index';
import { isReadableTeamColor, onTeamColor, resolveTeamColor } from './team';

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

describe('readable team colour', () => {
  /** The rule from PRD §3: white or ink text reaches 4.5:1 on it. */
  const bestText = (hex: string) =>
    Math.max(contrastRatio(colors.surface, hex), contrastRatio(colors.ink, hex));

  it('is exported for the portal, the athlete app and the API', () => {
    expect(fromIndex).toBe(isReadableTeamColor);
  });

  it('accepts the default navy and colours with plenty of contrast', () => {
    expect(isReadableTeamColor(colors.team)).toBe(true);
    expect(isReadableTeamColor(colors.brand)).toBe(true);
    for (const c of ['#1E3F7B', '#0B1F5C', '#FFD100', '#FFFFFF', '#000000', '#5A2D82']) {
      expect(isReadableTeamColor(c), c).toBe(true);
    }
  });

  it('refuses a mid grey that neither white nor ink text reaches 4.5:1 on', () => {
    expect(bestText('#777777')).toBeLessThan(4.5);
    expect(isReadableTeamColor('#777777')).toBe(false);
    expect(isReadableTeamColor('#7D7D7D')).toBe(false);
  });

  it('accepts the greys just either side of the unreadable band', () => {
    // #767676 is the lightest grey white text passes on; #7E7E7E the darkest ink passes on.
    expect(contrastRatio(colors.surface, '#767676')).toBeGreaterThanOrEqual(4.5);
    expect(isReadableTeamColor('#767676')).toBe(true);
    expect(contrastRatio(colors.ink, '#7E7E7E')).toBeGreaterThanOrEqual(4.5);
    expect(isReadableTeamColor('#7E7E7E')).toBe(true);
  });

  it('reads lower-case hex the same as upper-case', () => {
    expect(isReadableTeamColor('#1e3f7b')).toBe(true);
    expect(isReadableTeamColor('#777777'.toLowerCase())).toBe(false);
    expect(isReadableTeamColor('#ffd100')).toBe(isReadableTeamColor('#FFD100'));
  });

  it('measures white text the way WebAIM’s contrast checker does', () => {
    // Published ratios for white text on each colour (webaim.org/resources/contrastchecker).
    const webaim: [string, number][] = [
      ['#000000', 21],
      ['#595959', 7],
      ['#767676', 4.54],
      ['#0000FF', 8.59],
      ['#008000', 5.14],
      ['#FF0000', 4],
    ];
    for (const [hex, ratio] of webaim) {
      expect(contrastRatio('#FFFFFF', hex), hex).toBeCloseTo(ratio, 2);
    }
  });

  it('decides known colours as worked out by hand from WCAG relative luminance', () => {
    // Ink (#111418) has luminance ≈ 0.0069, so ink reaches 4.5:1 on luminance ≥ ≈ 0.206 and
    // white on ≤ ≈ 0.183. Each colour's luminance is noted.
    const readable = {
      '#1E3F7B': 'navy, 0.053: white 10.2',
      '#767676': '0.181: white 4.54',
      '#7E7E7E': '0.209: ink 4.55',
      '#FF0000': '0.213: white only 4.0, but ink 4.62',
      '#008000': '0.154: white 5.14',
      '#0000FF': '0.072: white 8.59',
      '#FFD100': 'yellow, 0.67: ink',
    };
    const unreadable = {
      '#777777': '0.185: white 4.48, ink 4.12',
      '#7D7D7D': '0.205: white 4.12, ink 4.49',
      '#F50000': 'red, 0.194: white 4.30, ink 4.29',
      '#008E00': 'green, 0.194: white 4.31, ink 4.28',
    };
    for (const [hex, why] of Object.entries(readable)) {
      expect(isReadableTeamColor(hex), `${hex} (${why})`).toBe(true);
    }
    for (const [hex, why] of Object.entries(unreadable)) {
      expect(isReadableTeamColor(hex), `${hex} (${why})`).toBe(false);
    }
  });
});

describe('generated css', () => {
  it('tokens.css is up to date (run `pnpm --filter @team-impact/ui-tokens build:css`)', () => {
    // Git on Windows (core.autocrlf) checks the file out with CRLF; only the content matters.
    const file = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8').replace(
      /\r\n/g,
      '\n',
    );
    expect(file).toBe(tokensToCss());
  });
});
