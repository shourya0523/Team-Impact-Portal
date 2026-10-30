/**
 * Platform-neutral half of the UI primitives: data types, the visual spec and generated card art.
 * Components live behind platform entry points so neither app bundles the other's renderer:
 *   - `@team-impact/ui-primitives/native` for the Expo app (Reanimated, gesture handler, SVG)
 *   - `@team-impact/ui-primitives/web` for the Vite portal (DOM + CSS 3D transforms)
 */
export * from './athlete-card/types';
export * from './athlete-card/spec';
export {
  CARD_LIMITS,
  NAME_MAX_WIDTH,
  describeCard,
  fitCardName,
  prepareCard,
  sampleAthlete,
  type PreparedCard,
} from './athlete-card/model';
export {
  ELLIPSIS,
  ellipsize,
  fitName,
  textWidth,
  type NameFit,
  type NameFitOptions,
} from './athlete-card/fit';
export {
  DEALT,
  FLAT_POSE,
  cssLinearEasing,
  dealStart,
  mix,
  springCurve,
  tiltFromPoint,
  type DealPose,
  type SpringCurve,
  type SpringParams,
  type TiltPose,
} from './athlete-card/tilt';
export { backArt, frontArt, type CardFaceArt, type PatternLayer } from './athlete-card/patterns';
export {
  brandPalette,
  paletteFromPixels,
  type CardPalette,
  type PixelSampler,
} from './athlete-card/palette';
