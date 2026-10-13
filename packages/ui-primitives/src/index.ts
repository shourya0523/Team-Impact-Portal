/**
 * Platform-neutral half of the UI primitives: data types, the visual spec and generated card art.
 * Components live behind platform entry points so neither app bundles the other's renderer:
 *   - `@team-impact/ui-primitives/native` for the Expo app (Reanimated, gesture handler, SVG)
 *   - `@team-impact/ui-primitives/web` for the Vite portal (DOM + CSS 3D transforms)
 */
export * from './athlete-card/types';
export * from './athlete-card/spec';
export { CARD_LIMITS, prepareCard, sampleAthlete, type PreparedCard } from './athlete-card/model';
export { backArt, frontArt, type CardFaceArt, type PatternLayer } from './athlete-card/patterns';
export {
  brandPalette,
  paletteFromPixels,
  type CardPalette,
  type PixelSampler,
} from './athlete-card/palette';
