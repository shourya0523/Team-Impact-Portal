/**
 * Text fitting for the card's fixed-size faces. The card can't grow, so long names shrink, then
 * wrap onto a second line, then (only for absurd lengths) end in an ellipsis. Widths are estimated
 * from an average glyph width, so this runs the same in the app, the portal, the PNG export and
 * tests. Renderers keep a platform safety net (ellipsis on the web, `adjustsFontSizeToFit` on
 * native) in case a real font runs wider than the estimate.
 */

export interface NameFitOptions {
  /** Room for one line, in base units. */
  maxWidth: number;
  maxSize: number;
  minSize: number;
  /** Average glyph advance as a fraction of the font size (uppercase display face). */
  charWidth: number;
  maxLines?: 1 | 2;
}

export interface NameFit {
  /** One or two lines, in reading order. Renderers uppercase them through the text style. */
  lines: string[];
  fontSize: number;
  /** True when a line had to end in an ellipsis even at `minSize`. */
  truncated: boolean;
}

export const ELLIPSIS = '…';

/** Estimated width of `text` at `fontSize`. */
export const textWidth = (text: string, fontSize: number, charWidth: number) =>
  [...text].length * fontSize * charWidth;

/** Cuts `text` to at most `maxChars` characters, ending in an ellipsis when it was cut. */
export const ellipsize = (text: string, maxChars: number) => {
  const chars = [...text];
  if (chars.length <= maxChars) return text;
  if (maxChars <= 1) return ELLIPSIS;
  return `${chars
    .slice(0, maxChars - 1)
    .join('')
    .trimEnd()}${ELLIPSIS}`;
};

/**
 * Every way to break `words` into two lines at a space or right after a hyphen, so
 * "Featherstonehaugh-Worthington" can still split when it's the only long word.
 */
const twoLineSplits = (full: string): [string, string][] => {
  const splits: [string, string][] = [];
  for (let i = 1; i < full.length; i++) {
    const ch = full[i - 1];
    if (full[i] === ' ') splits.push([full.slice(0, i).trim(), full.slice(i + 1).trim()]);
    else if (ch === '-' && full[i] !== ' ') splits.push([full.slice(0, i), full.slice(i)]);
  }
  return splits.filter(([a, b]) => a !== '' && b !== '');
};

const longest = (lines: string[]) => Math.max(0, ...lines.map((l) => [...l].length));

/**
 * Fits "First Last" into the nameplate: one line at the largest size that fits, else the most
 * balanced two-line split (at a space or hyphen) at the largest size that fits, else the
 * smallest size with an ellipsis.
 */
export const fitName = (first: string, last: string, options: NameFitOptions): NameFit => {
  const { maxWidth, maxSize, minSize, charWidth, maxLines = 2 } = options;
  const full = `${first.trim()} ${last.trim()}`.trim().replace(/\s+/g, ' ');
  if (full === '') return { lines: [], fontSize: maxSize, truncated: false };

  const fits = (chars: number, size: number) => chars * size * charWidth <= maxWidth + 0.001;
  const oneLine = [...full].length;
  const split =
    maxLines === 2
      ? twoLineSplits(full).reduce<[string, string] | null>(
          (best, s) => (!best || longest(s) < longest(best) ? s : best),
          null,
        )
      : null;
  const twoLine = split ? longest(split) : Infinity;

  for (let size = maxSize; size >= minSize; size--) {
    if (fits(oneLine, size)) return { lines: [full], fontSize: size, truncated: false };
    if (split && fits(twoLine, size)) return { lines: split, fontSize: size, truncated: false };
  }

  const maxChars = Math.max(1, Math.floor(maxWidth / (minSize * charWidth)));
  const lines = split ?? [full];
  return { lines: lines.map((l) => ellipsize(l, maxChars)), fontSize: minSize, truncated: true };
};
