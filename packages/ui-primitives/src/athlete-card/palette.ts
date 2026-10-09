import { useEffect, useState } from 'react';
import { cardColors } from './spec';

/**
 * Card colours derived from the athlete's photo, Discord-banner style. The photo is shrunk to a
 * 16 x 16 thumbnail (256 pixels), so extraction is a few hundred loop iterations: fast enough to
 * run on every upload without a worker.
 *
 * Every dark colour is pushed below a luminance ceiling so white text stays above 4.5:1, and the
 * light tints stay light enough for ink text, whatever the photo looks like.
 */
export interface CardPalette {
  /** Front gradient, top-left. Darkest. */
  deep: string;
  /** Front gradient, bottom-right. */
  base: string;
  /** Front radial glow; also the no-photo placeholder fill. */
  glow: string;
  /** Back header band and dark accents on the light back face. */
  band: string;
  /** Back gradient, top. */
  tint: string;
  /** Back gradient, bottom. */
  tintDeep: string;
}

export const brandPalette: CardPalette = {
  deep: cardColors.navyDeep,
  base: cardColors.blue,
  glow: cardColors.blueBright,
  band: cardColors.navy,
  tint: cardColors.offWhite,
  tintDeep: cardColors.lightBlue,
};

/** Thumbnail edge used by both platform samplers. */
export const PALETTE_SAMPLE_SIZE = 16;

/** Max relative luminance behind white text: 0.12 gives ~5:1 contrast. */
const DARK_CEILING = 0.12;

interface Hsl {
  h: number;
  s: number;
  l: number;
}

const rgbToHsl = (r: number, g: number, b: number): Hsl => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0)) * 60
      : max === g
        ? ((b - r) / d + 2) * 60
        : ((r - g) / d + 4) * 60;
  return { h, s, l };
};

const hslToRgb = ({ h, s, l }: Hsl): [number, number, number] => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
};

const luminance = (rgb: [number, number, number]) => {
  const [r = 0, g = 0, b = 0] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const toHex = (rgb: [number, number, number]) =>
  `#${rgb
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Lowers lightness until the colour is dark enough for white text. */
const darkTone = (hsl: Hsl) => {
  let tone = hsl;
  while (tone.l > 0.04 && luminance(hslToRgb(tone)) > DARK_CEILING)
    tone = { ...tone, l: tone.l - 0.02 };
  return toHex(hslToRgb(tone));
};

const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/**
 * Picks a dominant and a secondary colour from RGBA pixels and builds a palette around them.
 * Pixels are bucketed at 4 bits per channel; buckets score by population, boosted by saturation
 * and damped near black/white, so a vivid jersey beats a grey wall of the same size.
 */
export const paletteFromPixels = (rgba: ArrayLike<number>): CardPalette => {
  const buckets = new Map<number, { r: number; g: number; b: number; count: number }>();
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if ((rgba[i + 3] ?? 0) < 128) continue;
    const r = rgba[i] ?? 0;
    const g = rgba[i + 1] ?? 0;
    const b = rgba[i + 2] ?? 0;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.count++;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
  }
  if (buckets.size === 0) return brandPalette;

  const ranked = [...buckets.values()]
    .map(({ r, g, b, count }) => {
      const hsl = rgbToHsl(r / count, g / count, b / count);
      const extreme = hsl.l < 0.08 || hsl.l > 0.94 ? 0.25 : 1;
      return { hsl, score: count * (0.35 + hsl.s) * extreme };
    })
    .sort((a, b) => b.score - a.score);

  const first = ranked[0]!.hsl;
  const chromatic = first.s >= 0.12;
  const second = ranked.find(({ hsl }) => hsl.s >= 0.15 && hueDistance(hsl.h, first.h) >= 25)
    ?.hsl ?? { ...first, h: (first.h + 35) % 360 };

  // Near-greyscale photos get a near-greyscale card rather than an invented colour.
  const sat = (s: number, min: number, max: number) =>
    chromatic ? clamp(s, min, max) : Math.min(s, 0.08);
  const s1 = first.s;
  const s2 = chromatic ? second.s : s1;
  const h2 = chromatic ? second.h : first.h;

  return {
    deep: darkTone({ h: first.h, s: sat(s1, 0.35, 0.8), l: 0.16 }),
    base: darkTone({ h: h2, s: sat(s2, 0.35, 0.85), l: 0.32 }),
    glow: toHex(hslToRgb({ h: h2, s: sat(s2, 0.5, 0.95), l: 0.56 })),
    band: darkTone({ h: first.h, s: sat(s1, 0.35, 0.75), l: 0.26 }),
    tint: toHex(hslToRgb({ h: first.h, s: sat(s1 * 0.5, 0.15, 0.45), l: 0.96 })),
    tintDeep: toHex(hslToRgb({ h: h2, s: sat(s2 * 0.6, 0.2, 0.55), l: 0.86 })),
  };
};

export type PixelSampler = (uri: string) => Promise<ArrayLike<number> | null>;

const cache = new Map<string, Promise<CardPalette>>();
const CACHE_LIMIT = 32;

/** Memoised per URI, so re-renders, flips and list views never resample the same photo. */
export const paletteForPhoto = (uri: string, sample: PixelSampler) => {
  let pending = cache.get(uri);
  if (!pending) {
    pending = sample(uri)
      .then((pixels) => (pixels ? paletteFromPixels(pixels) : brandPalette))
      .catch(() => brandPalette);
    cache.set(uri, pending);
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  }
  return pending;
};

/**
 * The card's palette: an explicit override wins, then the photo's colours, then the brand.
 * Keeps the previous photo's colours while a new one is sampled, so there's no flash of navy.
 */
export const useCardPalette = (
  photoUri: string | null,
  override: CardPalette | undefined,
  sample: PixelSampler,
) => {
  const [palette, setPalette] = useState(brandPalette);
  useEffect(() => {
    if (override || !photoUri) return;
    let live = true;
    void paletteForPhoto(photoUri, sample).then((next) => live && setPalette(next));
    return () => {
      live = false;
    };
  }, [photoUri, override, sample]);
  if (override) return override;
  return photoUri ? palette : brandPalette;
};
