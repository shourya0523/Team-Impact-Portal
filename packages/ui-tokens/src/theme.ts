import { colors, semanticColors } from './colors';

export type ThemeMode = 'light' | 'dark';

export const themes = {
  light: {
    ...semanticColors.light,
    palette: colors,
  },
  dark: {
    ...semanticColors.dark,
    palette: colors,
  },
} as const;

export type Theme = (typeof themes)[ThemeMode];
