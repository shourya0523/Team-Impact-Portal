/** Corner radii. `card` is the Baseball Card. */
export const radius = {
  sm: 10,
  md: 12,
  lg: 14,
  xl: 16,
  card: 18,
} as const;

export type Radius = typeof radius;
