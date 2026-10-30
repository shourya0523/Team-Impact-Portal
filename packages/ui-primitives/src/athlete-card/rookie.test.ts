import { describe, expect, it } from 'vitest';
import { colors, contrastRatio, contrastThreshold } from '@team-impact/ui-tokens';
import { describeCard, prepareCard, sampleAthlete } from './model';
import { brandPalette, paletteFromPixels } from './palette';
import { cardColors } from './spec';
import type { AthleteCardData } from './types';

/** Bare minimum a card can be given: names and sport, everything else empty. */
const empty: AthleteCardData = {
  id: 'empty',
  firstName: 'Ana',
  lastName: 'Li',
  sport: 'Soccer',
  resume: { stats: [], experience: [], skills: [] },
  personal: { facts: [], interests: [] },
};

describe('rookie front (TI-114)', () => {
  it('builds the mockup lines: number, position · team · school, class / major / division', () => {
    const card = prepareCard(sampleAthlete);
    expect(card.jerseyDigits).toBe('8');
    expect(card.rookieLine).toBe("Midfielder · Women's Soccer · Northeastern");
    expect(card.rookieStats).toEqual([
      { label: 'Class', value: '2027' },
      { label: 'Major', value: 'Business Analytics' },
      { label: 'Division', value: 'I' },
    ]);
    expect(card.seasonLine).toBe('Season 2026');
  });

  it('uses the team colour for the stripe, brand navy when missing or invalid', () => {
    expect(prepareCard({ ...empty, teamColor: '#0B6E4F' }).teamColor).toBe('#0B6E4F');
    expect(prepareCard({ ...empty, teamColor: null }).teamColor).toBe(colors.team);
    expect(prepareCard({ ...empty, teamColor: 'red' }).teamColor).toBe(colors.team);
  });

  it('leaves out whatever is empty instead of printing blanks', () => {
    const card = prepareCard({ ...empty, jerseyNumber: '', major: '  ', classYear: 2028 });
    expect(card.photoUri).toBeNull();
    expect(card.jerseyDigits).toBeNull();
    expect(card.jerseyNumber).toBeNull();
    expect(card.rookieLine).toBe('Soccer');
    expect(card.rookieStats).toEqual([{ label: 'Class', value: '2028' }]);
    expect(card.experience).toEqual([]);
    expect(card.skills).toEqual([]);
    expect(card.bio).toBeNull();
    expect(card.seasonLine).toBeNull();
    expect(card.initials).toBe('AL');
  });

  it('keeps one line of major and keeps "07" as printed', () => {
    const card = prepareCard({
      ...empty,
      major: 'Economics, Data Science minor',
      jerseyNumber: '07',
    });
    expect(card.rookieStats).toEqual([{ label: 'Major', value: 'Economics' }]);
    expect(card.jerseyDigits).toBe('07');
  });

  it('falls back to the first resume stats for callers without class/major/division', () => {
    const card = prepareCard({
      ...empty,
      resume: {
        ...empty.resume,
        stats: [
          { label: 'Class', value: '2026' },
          { label: '', value: 'x' },
          { label: 'Major', value: 'History' },
        ],
      },
    });
    expect(card.rookieStats).toEqual([
      { label: 'Class', value: '2026' },
      { label: 'Major', value: 'History' },
    ]);
  });

  it('drops blank skills, facts and interests', () => {
    const card = prepareCard({
      ...empty,
      resume: { ...empty.resume, skills: [' ', 'SQL'] },
      personal: { facts: [{ label: 'City', value: ' ' }], interests: ['', 'Chess'] },
    });
    expect(card.skills).toEqual(['SQL']);
    expect(card.facts).toEqual([]);
    expect(card.interests).toEqual(['Chess']);
  });

  it('describes each side for screen readers', () => {
    const card = prepareCard(sampleAthlete);
    expect(describeCard(card, false)).toMatch(
      /^Maya Okafor, athlete resume\. Number 8, Midfielder/,
    );
    expect(describeCard(card, false)).toContain('Division I');
    expect(describeCard(card, true)).toMatch(/experience and personal info\. Analytics Intern at/);
    expect(describeCard(prepareCard(empty), true)).toBe('Ana Li, experience and personal info. ');
  });
});

describe('card text contrast (AA)', () => {
  // Front text sits on the palette's dark colours; check the navy default and photo palettes
  // from very light, very dark, saturated and grey photos.
  const solid = (r: number, g: number, b: number) =>
    Array.from({ length: 256 }, () => [r, g, b, 255]).flat();
  const palettes = [
    brandPalette,
    paletteFromPixels(solid(250, 250, 250)),
    paletteFromPixels(solid(10, 10, 10)),
    paletteFromPixels(solid(255, 220, 0)),
    paletteFromPixels(solid(0, 200, 255)),
    paletteFromPixels(solid(128, 128, 128)),
    paletteFromPixels(solid(255, 40, 60)),
  ];

  it.each(palettes.map((p, i) => [i, p] as const))(
    'white names/values and yellow labels pass on palette %i',
    (_, p) => {
      for (const bg of [p.deep, p.base]) {
        expect(contrastRatio(cardColors.white, bg)).toBeGreaterThanOrEqual(
          contrastThreshold.normalText,
        );
        expect(contrastRatio(cardColors.yellow, bg)).toBeGreaterThanOrEqual(
          contrastThreshold.normalText,
        );
      }
    },
  );

  it('back face text passes on its light tint', () => {
    for (const p of palettes) {
      expect(contrastRatio(cardColors.ink, p.tint)).toBeGreaterThanOrEqual(
        contrastThreshold.normalText,
      );
      expect(contrastRatio(cardColors.inkMuted, p.tint)).toBeGreaterThanOrEqual(
        contrastThreshold.normalText,
      );
      // Eyebrows, experience bars and chip text use the palette's band colour.
      expect(contrastRatio(p.band, p.tint)).toBeGreaterThanOrEqual(contrastThreshold.normalText);
    }
  });
});
