/**
 * Signing Day design tokens (TI-72), shared by the Expo app, React Native Web and the Vite portal.
 * Plain numbers and strings only. Platform adapters (Reanimated, Motion, CSS) live with their app
 * or in `css.ts`, and are derived from these values.
 */
import { colors } from './colors';
import { layout } from './layout';
import { motion } from './motion';
import { radius } from './radius';
import { spacing } from './spacing';
import { typography } from './typography';

export { colors, type Colors } from './colors';
export { spacing, type Spacing } from './spacing';
export { radius, type Radius } from './radius';
export { layout, type Layout } from './layout';
export { typography, fontFamily, fontWeight, type Typography, type TypeStyle } from './typography';
export { motion, duration, easing, spring, tilt, type Motion } from './motion';
export {
  contrastRatio,
  contrastThreshold,
  readableOn,
  relativeLuminance,
  textPairs,
  uiPairs,
  type ColorPair,
} from './accessibility';
export { resolveTeamColor, onTeamColor } from './team';
export { tokensToCss } from './css';

export const tokens = { colors, spacing, radius, layout, typography, motion } as const;
export type Tokens = typeof tokens;
