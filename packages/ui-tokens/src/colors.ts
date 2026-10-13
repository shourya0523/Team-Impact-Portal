/**
 * Team Impact color tokens derived from the Team Impact Figma design system.
 *
 * Palette families:
 * primary    = Team Impact blue
 * secondary  = Team Impact navy
 * tertiary   = light blue
 * quaternary = yellow
 * quinary    = red accent
 * senary     = off-white
 * septenary  = ink
 * grey       = neutral grey
 */

export const palette = {
  primary: {
    100: '#ecf0fe',
    200: '#c5d3fc',
    300: '#89abfa',
    400: '#3185f7',
    500: '#1b61bb',
    600: '#0f407f',
    700: '#052148',
  },
  secondary: {
    100: '#edf0fd',
    200: '#c7d3f8',
    300: '#90abf1',
    400: '#4c85ea',
    500: '#3161b2',
    600: '#1e4079',
    700: '#0d2244',
  },
  tertiary: {
    100: '#c4daeb',
    200: '#86b6d5',
    300: '#688fa8',
    400: '#4c697d',
    500: '#324754',
    600: '#19262f',
    700: '#0a1217',
  },
  quaternary: {
    100: '#ffda00',
    200: '#d1b300',
    300: '#a68d00',
    400: '#7c6900',
    500: '#554700',
    600: '#302800',
    700: '#151100',
  },
  quinary: {
    100: '#ffeced',
    200: '#ffb9bb',
    300: '#ff7b81',
    400: '#fd002b',
    500: '#ba001d',
    600: '#7b000f',
    700: '#410004',
  },
  senary: {
    100: '#f5f7fb',
    200: '#c2cfe8',
    300: '#8da9d5',
    400: '#6484b1',
    500: '#476082',
    600: '#2d3e56',
    700: '#151f2d',
  },
  septenary: {
    100: '#f1f1f1',
    200: '#cbcbcb',
    300: '#a4a4a4',
    400: '#7f7f7f',
    500: '#5b5b5b',
    600: '#3a3a3a',
    700: '#1c1c1c',
  },
  grey: {
    100: '#f0f1f1',
    200: '#d3d3d6',
    300: '#abacb1',
    400: '#85868d',
    500: '#616368',
    600: '#404145',
    700: '#212225',
  },
} as const;

export const colors = {
  primary: palette.primary[600],
  primaryDark: palette.primary[700],
  primaryContrast: '#FFFFFF',

  secondary: palette.secondary[600],
  secondaryDark: palette.secondary[700],
  secondaryContrast: '#FFFFFF',

  accent: palette.quaternary[100],
  accentContrast: palette.septenary[700],

  tertiary: palette.tertiary[100],
  surface: palette.senary[100],
  background: '#FFFFFF',

  text: palette.septenary[700],
  textMuted: palette.grey[600],
  border: palette.grey[200],

  danger: palette.quinary[400],
  dangerStrong: palette.quinary[500],
} as const;

/**
 * Approved semantic pairings called out by the Figma design system.
 *
 * Red is intentionally excluded from normal text/background pairings because
 * #fd002b on white is below WCAG AA for normal text.
 */
export const semanticColors = {
  light: {
    background: colors.background,
    surface: colors.surface,
    text: colors.text,
    textMuted: colors.textMuted,
    primaryAction: colors.secondary,
    primaryActionText: colors.primaryContrast,
    secondaryAction: colors.accent,
    secondaryActionText: colors.accentContrast,
    border: colors.border,
    accentSurface: colors.tertiary,
  },
  dark: {
    background: colors.text,
    surface: colors.secondaryDark,
    text: '#FFFFFF',
    textMuted: palette.grey[200],
    primaryAction: colors.accent,
    primaryActionText: colors.accentContrast,
    secondaryAction: colors.secondary,
    secondaryActionText: colors.primaryContrast,
    border: palette.grey[500],
    accentSurface: colors.primary,
  },
} as const;
