import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Stroke icons drawn with react-native-svg (Lucide-style paths, ISC). No icon font needed. */
const ICONS = {
  home: <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  calendar: (
    <>
      <Rect x={3} y={4} width={18} height={18} rx={2} />
      <Path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  users: (
    <>
      <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <Circle cx={9} cy={7} r={4} />
      <Path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  card: (
    <>
      <Rect x={5} y={2} width={14} height={20} rx={2} />
      <Path d="M9 7h6M9 11h6M9 15h4" />
    </>
  ),
  user: (
    <>
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  child: (
    <>
      <Circle cx={12} cy={6} r={3} />
      <Path d="M8 22v-6l-2-4 6-2 6 2-2 4v6" />
    </>
  ),
  swipe: (
    <>
      <Rect x={6} y={3} width={12} height={18} rx={2} />
      <Path d="M2 9v6M22 9v6" />
    </>
  ),
  list: <Path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  bell: (
    <>
      <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  plus: <Path d="M12 5v14M5 12h14" />,
  heart: <Path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" />,
  comment: <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  lock: (
    <>
      <Rect x={4} y={11} width={16} height={10} rx={2} />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  pin: (
    <>
      <Path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" />
      <Circle cx={12} cy={9} r={2.5} />
    </>
  ),
  check: <Path d="M20 6 9 17l-5-5" />,
  back: <Path d="M19 12H5M12 19l-7-7 7-7" />,
  search: (
    <>
      <Circle cx={11} cy={11} r={7} />
      <Path d="m21 21-4.3-4.3" />
    </>
  ),
  megaphone: (
    <>
      <Path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" />
      <Path d="M15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12" />
    </>
  ),
  shield: (
    <>
      <Path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5z" />
      <Path d="m9 12 2 2 4-4" />
    </>
  ),
  briefcase: (
    <>
      <Rect x={2} y={7} width={20} height={14} rx={2} />
      <Path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </>
  ),
  mail: (
    <>
      <Rect x={2} y={4} width={20} height={16} rx={2} />
      <Path d="m22 6-10 7L2 6" />
    </>
  ),
  qr: (
    <>
      <Rect x={3} y={3} width={7} height={7} />
      <Rect x={14} y={3} width={7} height={7} />
      <Rect x={3} y={14} width={7} height={7} />
      <Path d="M14 14h3v3M21 14v7h-4" />
    </>
  ),
  chevron: <Path d="m9 18 6-6-6-6" />,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 20,
  color = 'currentColor',
  fill = 'none',
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  color?: string;
  fill?: string;
  strokeWidth?: number;
}) {
  // Decorative: the button or text next to an icon carries its meaning.
  return (
    <View aria-hidden pointerEvents="none">
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={fill}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ICONS[name]}
      </Svg>
    </View>
  );
}
