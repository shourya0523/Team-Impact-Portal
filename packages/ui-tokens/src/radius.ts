/**
 * Team Impact radius scale.
 */
export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  pill: 9999,
} as const;

export type Radius = typeof radius;
