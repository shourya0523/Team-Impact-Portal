import { layout } from '@team-impact/ui-tokens';

/**
 * Official Team IMPACT logo (from Team IMPACT's own published material). Use on light
 * backgrounds; the artwork has no white keyline for dark ones. Never recolour or redraw it.
 */
export function Logo({ size = 'md' }: { size?: keyof typeof layout.logo }) {
  const height = layout.logo[size];
  return (
    <img
      src="/logo.png"
      alt="Team IMPACT"
      height={height}
      width={Math.round(height * layout.logoAspectRatio)}
    />
  );
}
