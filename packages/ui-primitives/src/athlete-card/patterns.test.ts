import { describe, expect, it } from 'vitest';
import { CARD_LIMITS, prepareCard, sampleAthlete } from './model';
import { backArt, frontArt } from './patterns';

describe('card art', () => {
  it('is deterministic per athlete and differs between athletes', () => {
    expect(frontArt('a')).toEqual(frontArt('a'));
    expect(frontArt('a').layers[0]?.d).not.toEqual(frontArt('b').layers[0]?.d);
    expect(backArt('a').layers[1]?.d).not.toEqual(backArt('b').layers[1]?.d);
  });

  it('emits only finite path numbers', () => {
    for (const art of [frontArt('x'), backArt('x')]) {
      for (const layer of art.layers) {
        expect(layer.d).not.toMatch(/NaN|Infinity/);
        expect(layer.d.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('prepareCard', () => {
  it('caps lists so content fits the fixed card', () => {
    const card = prepareCard({
      ...sampleAthlete,
      resume: { ...sampleAthlete.resume, skills: Array.from({ length: 12 }, (_, i) => `s${i}`) },
    });
    expect(card.skills).toHaveLength(CARD_LIMITS.skills);
    expect(card.initials).toBe('MO');
    expect(card.jerseyNumber).toBe('#8');
  });

  it('shows no contact block when contact is omitted (teen viewers)', () => {
    const card = prepareCard({
      ...sampleAthlete,
      personal: { ...sampleAthlete.personal, contact: undefined },
    });
    expect(card.contact).toEqual([]);
  });
});
