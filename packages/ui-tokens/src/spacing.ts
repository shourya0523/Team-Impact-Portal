/**
 * Team Impact spacing scale from the Figma design system.
 * Values are platform-neutral points/pixels.
 */
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
  '4xl': 80,
} as const;

export type Spacing = typeof spacing;
