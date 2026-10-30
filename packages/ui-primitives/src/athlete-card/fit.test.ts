import { describe, expect, it } from 'vitest';
import { ELLIPSIS, ellipsize, fitName, textWidth } from './fit';
import { NAME_MAX_WIDTH, fitCardName } from './model';
import { cardLayout } from './spec';

const opts = { maxWidth: 200, maxSize: 30, minSize: 15, charWidth: 0.5 };
const widest = (lines: string[], size: number) =>
  Math.max(...lines.map((l) => textWidth(l, size, opts.charWidth)));

describe('fitName', () => {
  it('keeps a short name on one line at the largest size', () => {
    expect(fitName('Jo', 'Lee', opts)).toEqual({
      lines: ['Jo Lee'],
      fontSize: 30,
      truncated: false,
    });
  });

  it('wraps onto two lines before shrinking', () => {
    // "Jordan Matthews" is 15 chars: 225 at 30 on one line, but "Matthews" alone fits at 30.
    const fit = fitName('Jordan', 'Matthews', opts);
    expect(fit.lines).toEqual(['Jordan', 'Matthews']);
    expect(fit.fontSize).toBe(30);
  });

  it('shrinks, then splits a long hyphenated name at the most balanced break', () => {
    const wide = { ...opts, maxWidth: 240 };
    const fit = fitName('Maximiliana', 'Featherstonehaugh-Worthington', wide);
    expect(fit.truncated).toBe(false);
    expect(fit.lines).toEqual(['Maximiliana', 'Featherstonehaugh-Worthington']);
    expect(fit.fontSize).toBeLessThan(30);
    expect(fit.fontSize).toBeGreaterThanOrEqual(15);
    expect(widest(fit.lines, fit.fontSize)).toBeLessThanOrEqual(wide.maxWidth);
    expect(fit.lines.join(' ').replace('- ', '-')).toBe(
      'Maximiliana Featherstonehaugh-Worthington',
    );
  });

  it('breaks after a hyphen when that balances the lines better', () => {
    expect(fitName('Al', 'Featherstonehaugh-Worthington', opts).lines).toEqual([
      'Al Featherstonehaugh-',
      'Worthington',
    ]);
  });

  it('ends in an ellipsis only when nothing fits at the smallest size', () => {
    const fit = fitName('A', 'B'.repeat(80), opts);
    expect(fit.truncated).toBe(true);
    expect(fit.fontSize).toBe(15);
    for (const line of fit.lines) {
      expect(textWidth(line, 15, opts.charWidth)).toBeLessThanOrEqual(opts.maxWidth);
    }
    expect(fit.lines.some((l) => l.endsWith(ELLIPSIS))).toBe(true);
  });

  it('handles blank parts and extra whitespace', () => {
    expect(fitName('  ', '  ', opts).lines).toEqual([]);
    expect(fitName(' Ana ', '', opts).lines).toEqual(['Ana']);
    expect(fitName('Ana  Maria', 'Lopez', { ...opts, maxWidth: 300 }).lines).toEqual([
      'Ana Maria Lopez',
    ]);
  });

  it('fits the real nameplate for every name the contracts allow (80 chars each)', () => {
    for (const [first, last] of [
      ['Maximiliana', 'Featherstonehaugh-Worthington'],
      ['Jordan', 'Lee'],
      ['X'.repeat(80), 'Y'.repeat(80)],
    ] as const) {
      const fit = fitCardName(first, last);
      expect(fit.lines.length).toBeLessThanOrEqual(2);
      expect(fit.fontSize).toBeGreaterThanOrEqual(cardLayout.nameMinSize);
      expect(fit.fontSize).toBeLessThanOrEqual(cardLayout.nameMaxSize);
      for (const line of fit.lines) {
        expect(textWidth(line, fit.fontSize, cardLayout.nameCharWidth)).toBeLessThanOrEqual(
          NAME_MAX_WIDTH + 0.001,
        );
      }
    }
  });
});

describe('ellipsize', () => {
  it('cuts to the limit including the ellipsis', () => {
    expect(ellipsize('Business Analytics', 9)).toBe(`Business${ELLIPSIS}`);
    expect(ellipsize('Short', 9)).toBe('Short');
    expect(ellipsize('Anything', 1)).toBe(ELLIPSIS);
  });
});
