import { brandPalette, type CardPalette } from './palette';
import { CARD_HEIGHT as H, CARD_WIDTH as W, cardColors } from './spec';

/**
 * Generative card artwork as plain SVG path strings in the 320 x 448 base box. Native draws them
 * with react-native-svg and the web with <svg>, so both platforms get identical patterns. The
 * athlete's id seeds the randomness: each athlete gets their own variation, and it is stable.
 */
export interface PatternLayer {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeLinecap?: 'round';
  /** Clip to the face's `clip` shape (e.g. keep light trails inside the header band). */
  clipped?: boolean;
  opacity: number;
}

export interface CardFaceArt {
  /** Diagonal background gradient, top-left to bottom-right. */
  gradient: readonly [from: string, to: string];
  glow: { cx: number; cy: number; r: number; color: string; opacity: number } | null;
  /** Clip shape for layers marked `clipped`. */
  clip?: string;
  layers: PatternLayer[];
}

type Point = readonly [x: number, y: number];
type Random = () => number;

const TAU = Math.PI * 2;

/** FNV-1a: turns the athlete id into a 32-bit seed. */
const hashSeed = (input: string) => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/** mulberry32: small, fast, deterministic PRNG. */
const createRandom = (seed: string): Random => {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const fmt = (value: number) => String(Math.round(value * 10) / 10);
const pt = ([x, y]: Point) => `${fmt(x)} ${fmt(y)}`;
const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** Closed curve through the midpoints of `points`, using each point as a quadratic control. */
const smoothClosed = (points: Point[]) => {
  const count = points.length;
  const at = (i: number) => points[((i % count) + count) % count] as Point;
  let d = `M${pt(mid(at(-1), at(0)))}`;
  for (let i = 0; i < count; i++) d += `Q${pt(at(i))} ${pt(mid(at(i), at(i + 1)))}`;
  return `${d}Z`;
};

const circle = (x: number, y: number, r: number) =>
  `M${fmt(x - r)} ${fmt(y)}a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(r * 2)} 0a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-r * 2)} 0`;

const roundedRect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${fmt(x + r)} ${fmt(y)}H${fmt(x + w - r)}A${r} ${r} 0 0 1 ${fmt(x + w)} ${fmt(y + r)}` +
  `V${fmt(y + h - r)}A${r} ${r} 0 0 1 ${fmt(x + w - r)} ${fmt(y + h)}` +
  `H${fmt(x + r)}A${r} ${r} 0 0 1 ${fmt(x)} ${fmt(y + h - r)}V${fmt(y + r)}A${r} ${r} 0 0 1 ${fmt(x + r)} ${fmt(y)}Z`;

/** Topographic contour lines: concentric rings warped by a few seeded sine waves. */
const contours = (random: Random, center: Point, rings: number, start: number, step: number) => {
  const phases = [random() * TAU, random() * TAU, random() * TAU];
  const [p0 = 0, p1 = 0, p2 = 0] = phases;
  let d = '';
  for (let ring = 0; ring < rings; ring++) {
    const base = start + ring * step;
    const wobble = 0.07 + ring * 0.006;
    const points: Point[] = [];
    for (let k = 0; k < 48; k++) {
      const angle = (k / 48) * TAU;
      const warp =
        0.6 * Math.sin(2 * angle + p0) +
        0.3 * Math.sin(3 * angle + p1) +
        0.2 * Math.sin(5 * angle + p2 + ring * 0.35);
      const r = base * (1 + wobble * warp);
      points.push([center[0] + r * Math.cos(angle), center[1] + r * Math.sin(angle)]);
    }
    d += smoothClosed(points);
  }
  return d;
};

/** Halftone dots on a hex grid that shrink with distance from `origin`. */
const halftone = (origin: Point, reach: number, spacing: number, maxRadius: number) => {
  const rowHeight = spacing * 0.866;
  let d = '';
  for (let row = 0, y = 0; y <= H; row++, y = row * rowHeight) {
    const offset = row % 2 ? spacing / 2 : 0;
    for (let x = offset; x <= W; x += spacing) {
      const distance = Math.hypot(x - origin[0], y - origin[1]);
      const r = maxRadius * (1 - distance / reach);
      if (r >= 0.35) d += circle(x, y, r);
    }
  }
  return d;
};

/** 45-degree speed stripes cutting across one corner. */
const cornerStripes = (offsets: number[], width: number) =>
  offsets
    .map((o) => `M0 ${fmt(H - o)}L${fmt(o)} ${H}L${fmt(o + width)} ${H}L0 ${fmt(H - o - width)}Z`)
    .join('');

type Corner = 'tl' | 'tr' | 'bl' | 'br';

/** L-shaped brackets in the card's corners, like a viewfinder. */
const brackets = (inset: number, length: number, corners: Corner[]) => {
  const paths: Record<Corner, string> = {
    tl: `M${inset} ${inset + length}V${inset}H${inset + length}`,
    tr: `M${W - inset - length} ${inset}H${W - inset}V${inset + length}`,
    bl: `M${inset} ${H - inset - length}V${H - inset}H${inset + length}`,
    br: `M${W - inset - length} ${H - inset}H${W - inset}V${H - inset - length}`,
  };
  return corners.map((corner) => paths[corner]).join('');
};

/** Open smooth curve through `points` (quadratic midpoint smoothing). */
const smoothOpen = (points: Point[]) => {
  const first = points[0];
  if (!first) return '';
  let d = `M${pt(first)}`;
  for (let i = 1; i < points.length - 1; i++) {
    d += `Q${pt(points[i] as Point)} ${pt(mid(points[i] as Point, points[i + 1] as Point))}`;
  }
  const last = points[points.length - 1] as Point;
  return `${d}L${pt(last)}`;
};

/**
 * Flowing "liquid metal" strands: left-to-right curves built from two seeded sine waves. Strands
 * share most of their phase so they run roughly parallel, like folds in chrome.
 */
const liquidStrands = (
  random: Random,
  count: number,
  top: number,
  gap: number,
  rise: number,
  amplitude: number,
) => {
  const phase = random() * TAU;
  const phase2 = random() * TAU;
  const wavelength = W * (0.9 + random() * 0.5);
  const strands: string[] = [];
  for (let i = 0; i < count; i++) {
    const base = top + i * gap + (random() - 0.5) * gap * 0.4;
    const points: Point[] = [];
    for (let x = -24; x <= W + 24; x += 10) {
      const y =
        base -
        (x / W) * rise +
        amplitude * Math.sin((x / wavelength) * TAU + phase + i * 0.4) +
        amplitude * 0.35 * Math.sin((x / (wavelength * 0.45)) * TAU + phase2 - i * 0.6);
      points.push([x, y]);
    }
    strands.push(smoothOpen(points));
  }
  return strands;
};

/**
 * Straight light streaks in tight pairs, like anamorphic lens flares. Each enters through the top
 * edge somewhere in [fromX, W] and runs down-right at `angle` degrees, so they cut across the
 * top-right corner and stay clear of the header text.
 */
const lightStreaks = (random: Random, count: number, angle: number, fromX: number) => {
  const dx = Math.cos((angle * Math.PI) / 180);
  const dy = Math.sin((angle * Math.PI) / 180);
  const reach = W;
  const streaks: string[] = [];
  for (let i = 0; i < count; i++) {
    const origin: Point = [fromX + random() * (W - fromX), 0];
    const line = (offset: number) => {
      const ox = origin[0] - dy * offset;
      const oy = origin[1] + dx * offset;
      return `M${fmt(ox - dx * reach)} ${fmt(oy - dy * reach)}L${fmt(ox + dx * reach)} ${fmt(oy + dy * reach)}`;
    };
    streaks.push(line(0), line(2.6 + random() * 2));
  }
  return streaks;
};

/** A soft glow without blur filters: the same path stroked wide-and-faint up to thin-and-bright. */
const glowStack = (
  d: string,
  color: string,
  stack: readonly (readonly [width: number, opacity: number])[],
  intensity = 1,
): PatternLayer[] =>
  stack.map(([strokeWidth, opacity]) => ({
    d,
    stroke: color,
    strokeWidth,
    opacity: opacity * intensity,
    strokeLinecap: 'round',
    clipped: true,
  }));

const LIQUID_GLOW = [
  [18, 0.03],
  [9, 0.05],
  [4, 0.1],
  [1.4, 0.55],
] as const;
const STREAK_GLOW = [
  [5, 0.05],
  [1.8, 0.14],
  [0.6, 0.85],
] as const;
const RIM_GLOW = [
  [6, 0.06],
  [2.4, 0.16],
  [1, 0.7],
] as const;
/** Stacked low-opacity strokes = a soft shadow ~10px deep, no blur filter needed. */
const SHADOW_STACK = [
  [18, 0.035],
  [12, 0.045],
  [7, 0.06],
  [3, 0.08],
] as const;
const BEAM_GLOW = [
  [78, 0.022],
  [48, 0.03],
  [22, 0.045],
] as const;

interface FaceGeometry {
  front: {
    contours: string;
    halftone: string;
    stripes: string;
    redStripe: string;
    frame: string;
    brackets: string;
  };
  back: {
    dots: string;
    flow: string;
    band: string;
    rim: string;
    shadow: string;
    beam: string;
    liquid: string;
    liquidFaint: string;
    streaks: string;
    accent: string;
    brackets: string;
  };
}

const geometryCache = new Map<string, FaceGeometry>();

/** Path generation is the expensive part, and it depends only on the seed, so it's cached. */
const geometryFor = (seed: string): FaceGeometry => {
  const cached = geometryCache.get(seed);
  if (cached) return cached;

  const front = createRandom(`${seed}:front`);
  const contourCenter: Point = [W * (0.2 + front() * 0.6), H * (0.74 + front() * 0.2)];

  const back = createRandom(`${seed}:back`);
  const right = 96 + back() * 8;
  const left = 104 + back() * 6;
  // The header's wavy bottom edge, drawn right to left and optionally pushed down by `offset`.
  const curve = (offset: number) =>
    `C${fmt(W * 0.72)} ${fmt(right + 24 + offset)} ` +
    `${fmt(W * 0.38)} ${fmt(left - 26 + offset)} 0 ${fmt(left + offset)}`;
  const edgePath = (offset: number) => `M${W} ${fmt(right + offset)}${curve(offset)}`;
  // Light work frames the header text instead of crossing it: strands along the top edge, strands
  // hugging the wavy bottom edge (clipping turns them into a chrome rim), streaks in the corner.
  const topStrands = liquidStrands(back, 2, 8, 7, -6, 5);
  const rimStrands = liquidStrands(back, 3, left - 7, 4, left - right, 5);
  const streaks = lightStreaks(back, 3, 28 + back() * 10, W * 0.62);
  const beam = lightStreaks(back, 1, 34, W * 0.7)[0] ?? '';
  // Faint echo of the liquid strands across the lower body, replacing the old ripple rings.
  const flow = liquidStrands(back, 9, H - 120, 9, 40, 7).join('');

  const geometry: FaceGeometry = {
    front: {
      contours: contours(front, contourCenter, 16, 14, 22),
      halftone: halftone([W, H], 170, 10, 2.3),
      stripes: cornerStripes([10, 26], 4),
      redStripe: cornerStripes([18], 4),
      frame: roundedRect(6, 6, W - 12, H - 12, 18),
      brackets: brackets(6, 20, ['tl', 'tr', 'bl', 'br']),
    },
    back: {
      dots: halftone([0, H], 210, 11, 1.9),
      flow,
      band: `M0 0H${W}V${fmt(right)}${curve(0)}Z`,
      rim: edgePath(0),
      shadow: edgePath(3),
      beam,
      liquid: [topStrands[0], rimStrands[0], rimStrands[2]].join(''),
      liquidFaint: [topStrands[1], rimStrands[1]].join(''),
      streaks: streaks.slice(1).join(''),
      accent: streaks[0] ?? '',
      brackets: brackets(10, 22, ['bl', 'br']),
    },
  };
  geometryCache.set(seed, geometry);
  if (geometryCache.size > 64) geometryCache.delete(geometryCache.keys().next().value as string);
  return geometry;
};

/** Front (resume): photo-tinted gradient, topo lines, halftone, speed stripes, viewfinder frame. */
export const frontArt = (seed: string, palette: CardPalette = brandPalette): CardFaceArt => {
  const g = geometryFor(seed).front;
  return {
    gradient: [palette.deep, palette.base],
    glow: { cx: W * 0.9, cy: H * 0.62, r: W * 0.8, color: palette.glow, opacity: 0.4 },
    layers: [
      { d: g.contours, stroke: cardColors.white, strokeWidth: 1, opacity: 0.09 },
      { d: g.halftone, fill: cardColors.yellow, opacity: 0.22 },
      { d: g.stripes, fill: cardColors.yellow, opacity: 0.5 },
      { d: g.redStripe, fill: cardColors.red, opacity: 0.5 },
      { d: g.frame, stroke: cardColors.white, strokeWidth: 1, opacity: 0.16 },
      //{ d: g.brackets, stroke: cardColors.yellow, strokeWidth: 2.5, opacity: 1 },
    ],
  };
};

/**
 * Back (personal): light tint, and a wavy header band with a chrome rim and a soft shadow beneath,
 * with sleek light work clipped inside:
 * a soft diagonal beam, liquid-metal strands, paired light streaks and one photo-tinted accent.
 */
export const backArt = (seed: string, palette: CardPalette = brandPalette): CardFaceArt => {
  const g = geometryFor(seed).back;
  return {
    gradient: [palette.tint, palette.tintDeep],
    glow: null,
    clip: g.band,
    layers: [
      { d: g.dots, fill: palette.band, opacity: 0.14 },
      { d: g.flow, stroke: palette.band, strokeWidth: 0.8, opacity: 0.12 },
      // Short soft shadow under the curve (drawn first, so the band hides all but the part below).
      ...SHADOW_STACK.map(([strokeWidth, opacity]) => ({
        d: g.shadow,
        stroke: palette.band,
        strokeWidth,
        opacity,
        strokeLinecap: 'round' as const,
      })),
      { d: g.band, fill: palette.band, opacity: 1 },
      // Glossy chrome rim along the curve, kept inside the band by the clip.
      ...glowStack(g.rim, cardColors.white, RIM_GLOW),
      ...glowStack(g.beam, cardColors.white, BEAM_GLOW),
      ...glowStack(g.liquid, cardColors.white, LIQUID_GLOW),
      ...glowStack(g.liquidFaint, cardColors.white, LIQUID_GLOW, 0.45),
      ...glowStack(g.streaks, cardColors.white, STREAK_GLOW, 0.8),
      ...glowStack(g.accent, palette.glow, STREAK_GLOW, 1.1),
      // { d: g.brackets, stroke: palette.band, strokeWidth: 2.5, opacity: 0.55 },
    ],
  };
};

/** SVG ids must be unique per document; React's useId output isn't a valid id on every platform. */
export const svgSafeId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '');
