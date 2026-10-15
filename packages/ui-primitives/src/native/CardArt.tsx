import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  LinearGradient,
  Mask,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import type { CardPalette } from '../athlete-card/palette';
import { CARD_HEIGHT, CARD_WIDTH, cardColors, cardLayout, photoBleed } from '../athlete-card/spec';
import { svgSafeId, type CardFaceArt, type PatternLayer } from '../athlete-card/patterns';

/** Splits layers into consecutive runs that share the same `clipped` flag, keeping paint order. */
const layerRuns = (layers: PatternLayer[]) => {
  const runs: { clipped: boolean; layers: { layer: PatternLayer; index: number }[] }[] = [];
  layers.forEach((layer, index) => {
    const clipped = Boolean(layer.clipped);
    const last = runs[runs.length - 1];
    if (last && last.clipped === clipped) last.layers.push({ layer, index });
    else runs.push({ clipped, layers: [{ layer, index }] });
  });
  return runs;
};

export const CardArt = ({ art }: { art: CardFaceArt }) => {
  const id = svgSafeId(useId());
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`}
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={art.gradient[0]} />
          <Stop offset="1" stopColor={art.gradient[1]} />
        </LinearGradient>
        {art.glow && (
          <RadialGradient id={`${id}glow`} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={art.glow.color} stopOpacity={art.glow.opacity} />
            <Stop offset="1" stopColor={art.glow.color} stopOpacity={0} />
          </RadialGradient>
        )}
        {art.clip && (
          <ClipPath id={`${id}clip`}>
            <Path d={art.clip} />
          </ClipPath>
        )}
      </Defs>
      <Rect width={CARD_WIDTH} height={CARD_HEIGHT} fill={`url(#${id}bg)`} />
      {art.glow && (
        <Circle cx={art.glow.cx} cy={art.glow.cy} r={art.glow.r} fill={`url(#${id}glow)`} />
      )}
      {layerRuns(art.layers).map(({ clipped, layers }) => {
        const paths = layers.map(({ layer, index }) => (
          <Path
            key={index}
            d={layer.d}
            fill={layer.fill ?? 'none'}
            stroke={layer.stroke}
            strokeWidth={layer.strokeWidth}
            strokeLinecap={layer.strokeLinecap}
            opacity={layer.opacity}
          />
        ));
        const key = layers[0]?.index ?? 0;
        return clipped && art.clip ? (
          <G key={key} clipPath={`url(#${id}clip)`}>
            {paths}
          </G>
        ) : (
          <G key={key}>{paths}</G>
        );
      })}
    </Svg>
  );
};

/** Two-stop gradient filling its parent; vertical unless `diagonal`. */
export const Gradient = ({
  from,
  to,
  fromOpacity = 1,
  toOpacity = 1,
  diagonal = false,
}: {
  from: string;
  to: string;
  fromOpacity?: number;
  toOpacity?: number;
  diagonal?: boolean;
}) => {
  const id = svgSafeId(useId());
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2={diagonal ? '1' : '0'} y2="1">
          <Stop offset="0" stopColor={from} stopOpacity={fromOpacity} />
          <Stop offset="1" stopColor={to} stopOpacity={toOpacity} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
};

/**
 * The front photo, bleeding past its frame and dissolving into the card (see `photoBleed`). An
 * SVG mask rather than overlays, so the card's patterns show through the fade.
 */
export const PhotoBleed = ({ uri, palette }: { uri: string | null; palette: CardPalette }) => {
  const id = svgSafeId(useId());
  const b = photoBleed;
  const inset = cardLayout.photoInset;
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`}
      preserveAspectRatio="none"
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id={`${id}v`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" />
          <Stop offset={b.topFade} stopColor="#fff" />
          <Stop offset={b.bottomFadeStart} stopColor="#fff" />
          <Stop offset="1" stopColor="#000" />
        </LinearGradient>
        <LinearGradient id={`${id}h`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#000" stopOpacity={1} />
          <Stop offset={b.sideFade} stopColor="#000" stopOpacity={0} />
          <Stop offset={1 - b.sideFade} stopColor="#000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000" stopOpacity={1} />
        </LinearGradient>
        <Mask
          id={`${id}m`}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={CARD_WIDTH}
          height={b.height}
        >
          <Rect width={CARD_WIDTH} height={b.height} fill={`url(#${id}v)`} />
          <Rect width={CARD_WIDTH} height={b.height} fill={`url(#${id}h)`} />
        </Mask>
        <LinearGradient id={`${id}p`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={palette.glow} />
          <Stop offset="1" stopColor={palette.base} />
        </LinearGradient>
        <LinearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={palette.deep} stopOpacity={0} />
          <Stop
            offset={(b.scrimPeak - b.scrimStart) / (1 - b.scrimStart)}
            stopColor={palette.deep}
            stopOpacity={b.scrimOpacity}
          />
          <Stop offset="1" stopColor={palette.deep} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <G mask={`url(#${id}m)`}>
        {uri ? (
          <SvgImage
            href={uri}
            x="0"
            y="0"
            width={CARD_WIDTH}
            height={b.height}
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          <Rect width={CARD_WIDTH} height={b.height} fill={`url(#${id}p)`} />
        )}
      </G>
      <Rect
        y={b.height * b.scrimStart}
        width={CARD_WIDTH}
        height={b.height * (1 - b.scrimStart)}
        fill={`url(#${id}s)`}
      />
      <Rect
        x={inset}
        y={inset}
        width={CARD_WIDTH - inset * 2}
        height={cardLayout.photoHeight}
        rx={cardLayout.photoRadius}
        fill="none"
        stroke={cardColors.yellow}
        strokeWidth={b.frameWidth}
        opacity={b.frameOpacity}
      />
    </Svg>
  );
};
