/**
 * Design tokens shared by the Expo app, React Native Web and the Vite portal.
 * Plain numbers and hex strings only, so every token works on all three.
 *
 * TODO(TI-72): placeholder values. Replace with the palette and type scale derived
 * from Team Impact's brand once the design language is settled.
 */
export const colors = {
  primary: '#1F3A93',
  primaryContrast: '#FFFFFF',
  accent: '#F2A900',
  background: '#FFFFFF',
  surface: '#F5F6F8',
  text: '#111827',
  textMuted: '#4B5563',
  border: '#E5E7EB',
  danger: '#B91C1C',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 4, md: 8, lg: 16, pill: 999 } as const;

export const fontSize = { sm: 13, md: 16, lg: 20, xl: 28 } as const;

export { palette } from './colors';
export { duration, easing, motion } from './motion';

export const tokens = { colors, spacing, radius, fontSize } as const;
export type Tokens = typeof tokens;
