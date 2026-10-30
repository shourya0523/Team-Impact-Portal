/** Corner radii. `card` is the Impact Card. */
export const radius = {
  sm: 10,
  md: 12,
  lg: 14,
  xl: 16,
  card: 18,
} as const;

export type Radius = typeof radius;
