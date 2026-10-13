/**
 * Team Impact typography.
 *
 * Typeface: DM Sans
 * Weights used by the Figma design system:
 * 400 Regular, 500 Medium, 700 Bold
 */

export const fontFamily = {
  sans: 'DM Sans',
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  bold: '700',
} as const;

export const typography = {
  displayLg: {
    fontFamily: fontFamily.sans,
    fontSize: 48,
    lineHeight: 56,
    fontWeight: fontWeight.bold,
  },
  headingLg: {
    fontFamily: fontFamily.sans,
    fontSize: 36,
    lineHeight: 44,
    fontWeight: fontWeight.bold,
  },
  headingMd: {
    fontFamily: fontFamily.sans,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: fontWeight.bold,
  },
  headingSm: {
    fontFamily: fontFamily.sans,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: fontWeight.bold,
  },
  bodyLg: {
    fontFamily: fontFamily.sans,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: fontWeight.regular,
  },
  bodyMd: {
    fontFamily: fontFamily.sans,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: fontWeight.regular,
  },
  bodySm: {
    fontFamily: fontFamily.sans,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: fontWeight.regular,
  },
  labelLg: {
    fontFamily: fontFamily.sans,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: fontWeight.medium,
  },
  labelMd: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: fontWeight.medium,
  },
  caption: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: fontWeight.regular,
  },
} as const;

export type Typography = typeof typography;
