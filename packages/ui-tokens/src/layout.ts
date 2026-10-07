/** Control and avatar sizes. */
export const layout = {
  /** Minimum touch target in points/pixels (WCAG 2.5.8 / platform guidance). */
  minTouchTarget: 44,
  buttonHeight: { md: 52, lg: 56 },
  avatar: { sm: 32, md: 44, lg: 64 },
  /** Logo heights. Width follows the artwork's aspect ratio (`logoAspectRatio`). */
  logo: { sm: 40, md: 64, lg: 96 },
  /** Width / height of the Team IMPACT logo canvas (1473 x 1693, shared by light and dark files). */
  logoAspectRatio: 1473 / 1693,
  /** Largest content width on the portal and on tablet. */
  maxContentWidth: 720,
} as const;

export type Layout = typeof layout;
