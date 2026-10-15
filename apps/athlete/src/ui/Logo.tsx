import { Image } from 'react-native';
import { layout } from '@team-impact/ui-tokens';
import logo from '../../assets/logo.png';
import logoDark from '../../assets/logo-dark.png';

export type LogoProps = {
  size?: keyof typeof layout.logo;
  /** `light` for light backgrounds; `dark` adds a white keyline for dark ones. Same canvas size. */
  variant?: 'light' | 'dark';
};

/**
 * Official Team IMPACT logo. PNGs at 1x/2x/3x are rendered from the source artwork; the vector
 * masters are in docs/brand. Never recolour or redraw it.
 */
export function Logo({ size = 'md', variant = 'light' }: LogoProps) {
  const height = layout.logo[size];
  return (
    <Image
      source={variant === 'dark' ? logoDark : logo}
      accessibilityRole="image"
      accessibilityLabel="Team IMPACT"
      resizeMode="contain"
      style={{ height, width: Math.round(height * layout.logoAspectRatio) }}
    />
  );
}
