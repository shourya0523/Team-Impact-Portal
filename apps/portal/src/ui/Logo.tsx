import { layout } from '@team-impact/ui-tokens';

export type LogoProps = {
  size?: keyof typeof layout.logo;
  /** `light` for light backgrounds; `dark` adds a white keyline for dark ones. Same canvas size. */
  variant?: 'light' | 'dark';
};

/** Official Team IMPACT logo, as vector (docs/brand). Never recolour or redraw it. */
export function Logo({ size = 'md', variant = 'light' }: LogoProps) {
  const height = layout.logo[size];
  return (
    <img
      src={variant === 'dark' ? '/logo-dark.svg' : '/logo.svg'}
      alt="Team IMPACT"
      height={height}
      width={Math.round(height * layout.logoAspectRatio)}
    />
  );
}
