import { Image } from 'react-native';
import { layout } from '@team-impact/ui-tokens';
import logo from '../../assets/logo.png';

/**
 * Official Team IMPACT logo (from Team IMPACT's own published material). Use on light
 * backgrounds; the artwork has no white keyline for dark ones. Never recolour or redraw it.
 */
export function Logo({ size = 'md' }: { size?: keyof typeof layout.logo }) {
  const height = layout.logo[size];
  return (
    <Image
      source={logo}
      accessibilityRole="image"
      accessibilityLabel="Team IMPACT"
      resizeMode="contain"
      style={{ height, width: Math.round(height * layout.logoAspectRatio) }}
    />
  );
}
