/**
 * Signing Day type scale. Barlow Condensed 800 uppercase for display, Barlow for UI.
 * `letterSpacing` is in em; adapters convert to px for React Native. Line heights are px.
 */
export const fontFamily = {
  display: 'Barlow Condensed',
  ui: 'Barlow',
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  display: 800,
} as const;

export interface TypeStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: number;
  letterSpacing: number;
  uppercase: boolean;
}

const display = (fontSize: number): TypeStyle => ({
  fontFamily: fontFamily.display,
  fontSize,
  lineHeight: Math.round(fontSize * 0.95),
  fontWeight: fontWeight.display,
  letterSpacing: 0,
  uppercase: true,
});

export const typography = {
  display: {
    xl: display(48),
    lg: display(44),
    md: display(34),
    sm: display(32),
  },
  body: {
    fontFamily: fontFamily.ui,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: fontWeight.regular,
    letterSpacing: 0,
    uppercase: false,
  },
  small: {
    fontFamily: fontFamily.ui,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: fontWeight.regular,
    letterSpacing: 0,
    uppercase: false,
  },
  caption: {
    fontFamily: fontFamily.ui,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: fontWeight.regular,
    letterSpacing: 0,
    uppercase: false,
  },
  eyebrow: {
    fontFamily: fontFamily.ui,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.12,
    uppercase: true,
  },
} as const;

export type Typography = typeof typography;
