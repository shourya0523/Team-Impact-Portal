/**
 * Semantic elevation levels from the Figma design system.
 *
 * Native and web implementations may map these levels to different
 * shadow properties. Keep the semantic level shared across platforms.
 */
export const elevation = {
  none: 0,
  sm: 1,
  md: 2,
  lg: 3,
} as const;

export type Elevation = typeof elevation;
