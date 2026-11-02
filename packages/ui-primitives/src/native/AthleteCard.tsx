import { useEffect, useId, useMemo, type Ref } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector, type GestureTouchEvent } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import {
  degreesPerPixel,
  edgeAmount,
  isBackAt,
  isFrontVisible,
  settleAngle,
} from '../athlete-card/flip';
import { describeCard, prepareCard, useFlipState, type PreparedCard } from '../athlete-card/model';
import { useCardPalette, type CardPalette } from '../athlete-card/palette';
import { backArt, frontArt, svgSafeId } from '../athlete-card/patterns';
import {
  CARD_WIDTH,
  NAME_LINE_HEIGHT,
  cardColors as c,
  cardHeightFor,
  cardLayout as l,
  cardMotion,
  cardShadow,
  cardShine,
  cardText,
  displayFont,
  gradientLine,
  holoStops,
  withAlpha,
  type CardTextStyle,
  type CardTextVariant,
} from '../athlete-card/spec';
import { dealStart, mix, tiltFromPoint } from '../athlete-card/tilt';
import type { AthleteCardData } from '../athlete-card/types';
import teamImpactLogo from '../../assets/team-impact-logo.png';
import { CardArt, PhotoBleed } from './CardArt';
import { samplePhoto } from './samplePhoto';

export type CardSide = 'front' | 'back';

export interface AthleteCardProps {
  athlete: AthleteCardData;
  /** Card width in points; height follows CARD_HEIGHT / CARD_WIDTH. */
  width?: number;
  /** Controlled flip state. Omit to let the card manage it. */
  flipped?: boolean;
  defaultFlipped?: boolean;
  onFlippedChange?: (flipped: boolean) => void;
  /** Skip photo sampling, e.g. when the palette was computed once and stored with the profile. */
  palette?: CardPalette;
  /** Tilt (up to `tilt.maxDegrees`) and holo shine under the finger. Default on; off under Reduce Motion. */
  tilt?: boolean;
  /** Deal the card in on mount (card-reveal motion; a fade under Reduce Motion). Default on. */
  dealIn?: boolean;
  style?: StyleProp<ViewStyle>;
}

export interface AthleteCardFaceProps {
  athlete: AthleteCardData;
  side?: CardSide;
  width?: number;
  palette?: CardPalette;
  style?: StyleProp<ViewStyle>;
  /** The flat face's host view, e.g. for `captureRef` from react-native-view-shot. */
  ref?: Ref<View>;
}

const flipEasing = Easing.bezier(...cardMotion.easing);
const dealEasing = Easing.bezier(...cardMotion.dealEasing);
const flipSpring = { damping: 18, stiffness: 160, mass: 1 };
const tiltSpring = { ...cardMotion.spring };
const followTiming = { duration: cardMotion.followDuration };
const shineTiming = { duration: cardMotion.shineFade };

/** Shared by the interactive card and the flat face: display data, colours, art and styles. */
const useCardModel = (athlete: AthleteCardData, width: number, paletteOverride?: CardPalette) => {
  const card = useMemo(() => prepareCard(athlete), [athlete]);
  const palette = useCardPalette(card.photoUri, paletteOverride, samplePhoto);
  const front = useMemo(() => frontArt(card.seed, palette), [card.seed, palette]);
  const back = useMemo(() => backArt(card.seed, palette), [card.seed, palette]);
  const styles = useMemo(() => createStyles(width / CARD_WIDTH), [width]);
  return { card, palette, front, back, styles };
};

/**
 * Baseball-style athlete card: the rookie front (photo, number, name, team, class/major/division)
 * and experience plus personal info on the back. Swipe sideways to turn it (it follows the finger
 * and settles on release), or tap to flip. It deals in on mount and, while touched, tilts toward
 * the finger with a holo shine, springing back to flat on release. Gesture and animation run on
 * the UI thread; React only hears about settled flips.
 */
export const AthleteCard = ({
  athlete,
  width = CARD_WIDTH,
  flipped,
  defaultFlipped,
  onFlippedChange,
  palette: paletteOverride,
  tilt = true,
  dealIn = true,
  style,
}: AthleteCardProps) => {
  const { card, palette, front, back, styles } = useCardModel(athlete, width, paletteOverride);
  const height = cardHeightFor(width);
  const [isFlipped, setFlipped] = useFlipState(flipped, defaultFlipped, onFlippedChange);
  const reduceMotion = useReducedMotion();
  const tiltOn = tilt && !reduceMotion;

  const angle = useSharedValue(isFlipped ? 180 : 0);
  const restAngle = useSharedValue(isFlipped ? 180 : 0);
  const dragStart = useSharedValue(0);
  const pressed = useSharedValue(1);
  const deal = useSharedValue(dealIn ? 0 : 1);
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const shineX = useSharedValue(0.5);
  const shineY = useSharedValue(0.5);
  const shineOpacity = useSharedValue(0);
  const turning = useSharedValue(false);

  // Card reveal on mount; under Reduce Motion `dealFrom` only fades.
  const dealFrom = useMemo(() => dealStart(cardMotion.deal, reduceMotion), [reduceMotion]);
  useEffect(() => {
    if (deal.get() === 1) return;
    deal.set(withTiming(1, { duration: cardMotion.dealDuration, easing: dealEasing }));
  }, [deal]);

  // Reduce Motion switched on mid-tilt: drop straight back to flat, with no shine.
  useEffect(() => {
    if (tiltOn) return;
    tiltX.set(0);
    tiltY.set(0);
    shineOpacity.set(0);
  }, [tiltOn, tiltX, tiltY, shineOpacity]);

  // Taps, buttons and controlled props land here; swipes have already moved restAngle.
  useEffect(() => {
    if (isBackAt(restAngle.get()) === isFlipped) return;
    const next = restAngle.get() + 180;
    restAngle.set(next);
    angle.set(
      withTiming(next, {
        duration: reduceMotion ? 0 : cardMotion.flipDuration,
        easing: flipEasing,
      }),
    );
  }, [isFlipped, reduceMotion, angle, restAngle]);

  const gesture = useMemo(() => {
    const perPixel = degreesPerPixel(width);
    const pressMs = reduceMotion ? 0 : cardMotion.pressDuration;
    const maxTilt = cardMotion.tiltMax;
    const peak = cardShine.opacity;
    const follow = (event: GestureTouchEvent) => {
      'worklet';
      const touch = event.allTouches[0];
      if (!tiltOn || turning.get() || !touch) return;
      const pose = tiltFromPoint(touch.x, touch.y, width, height, maxTilt);
      tiltX.set(withTiming(pose.rotateX, followTiming));
      tiltY.set(withTiming(pose.rotateY, followTiming));
      shineX.set(pose.shineX);
      shineY.set(pose.shineY);
      shineOpacity.set(withTiming(peak, shineTiming));
    };
    const release = () => {
      'worklet';
      tiltX.set(withSpring(0, tiltSpring));
      tiltY.set(withSpring(0, tiltSpring));
      shineOpacity.set(withTiming(0, shineTiming));
    };
    const pan = Gesture.Pan()
      .activeOffsetX([-10, 10])
      .failOffsetY([-14, 14])
      // Touch events arrive before the pan activates, so the tilt follows a resting finger too.
      .onTouchesDown(follow)
      .onTouchesMove(follow)
      .onStart(() => {
        // A swipe turns the card instead: let go of the tilt.
        turning.set(true);
        release();
        cancelAnimation(angle);
        dragStart.set(angle.get());
      })
      .onUpdate((event) => {
        angle.set(dragStart.get() + event.translationX * perPixel);
      })
      .onEnd((event) => {
        const velocity = event.velocityX * perPixel;
        const target = settleAngle(angle.get(), velocity, restAngle.get());
        angle.set(reduceMotion ? target : withSpring(target, { ...flipSpring, velocity }));
        if (target !== restAngle.get()) {
          restAngle.set(target);
          scheduleOnRN(setFlipped, isBackAt(target));
        }
      })
      .onFinalize(() => {
        turning.set(false);
        release();
      });
    const tap = Gesture.Tap()
      .onBegin(() => {
        pressed.set(withTiming(cardMotion.pressScale, { duration: pressMs }));
      })
      .onFinalize(() => {
        pressed.set(withTiming(1, { duration: pressMs }));
      })
      .onEnd(() => {
        scheduleOnRN(setFlipped, !isBackAt(restAngle.get()));
      });
    return Gesture.Race(pan, tap);
  }, [
    width,
    height,
    reduceMotion,
    tiltOn,
    angle,
    restAngle,
    dragStart,
    pressed,
    turning,
    tiltX,
    tiltY,
    shineX,
    shineY,
    shineOpacity,
    setFlipped,
  ]);

  const cardStyle = useAnimatedStyle(() => {
    const d = deal.get();
    const lift = 1 + (cardMotion.lift - 1) * edgeAmount(angle.get());
    return {
      opacity: mix(dealFrom.opacity, 1, d),
      transform: [
        { perspective: cardMotion.perspective },
        { translateY: mix(dealFrom.translateY, 0, d) * (width / CARD_WIDTH) },
        { rotateZ: `${mix(dealFrom.rotate, 0, d)}deg` },
        { rotateX: `${tiltX.get()}deg` },
        { rotateY: `${tiltY.get()}deg` },
        { scale: lift * pressed.get() * mix(dealFrom.scale, 1, d) },
      ],
    };
  });
  // backfaceVisibility alone is unreliable on Android, so each face also hides once edge-on.
  const frontStyle = useAnimatedStyle(() => ({
    opacity: isFrontVisible(angle.get()) ? 1 : 0,
    transform: [{ perspective: cardMotion.perspective }, { rotateY: `${angle.get()}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: isFrontVisible(angle.get()) ? 0 : 1,
    transform: [{ perspective: cardMotion.perspective }, { rotateY: `${angle.get() + 180}deg` }],
  }));

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'activate') setFlipped(!isFlipped);
  };

  const shine = { x: shineX, y: shineY, opacity: shineOpacity, width, height };
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={describeCard(card, isFlipped)}
        accessibilityHint="Swipe sideways or double tap to flip the card"
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={onAccessibilityAction}
        style={[style, { width, height }, cardStyle]}
      >
        <Animated.View style={[styles.face, frontStyle]} pointerEvents="none">
          <View style={styles.clip}>
            <CardArt art={front} />
            <FrontFace card={card} palette={palette} s={styles} />
            {tiltOn && <Shine side="front" {...shine} />}
          </View>
        </Animated.View>
        <Animated.View style={[styles.face, backStyle]} pointerEvents="none">
          <View style={styles.clip}>
            <CardArt art={back} />
            <BackFace card={card} palette={palette} s={styles} hint="Swipe or tap to flip ↻" />
            {tiltOn && <Shine side="back" {...shine} />}
          </View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};

/**
 * One side of the card, flat and still: no flip, tilt, shine, deal-in or shadow. Capture this
 * (react-native-view-shot `captureRef` on `ref`) for PNG export, so motion effects never bake
 * into the image.
 */
export const AthleteCardFace = ({
  athlete,
  side = 'front',
  width = CARD_WIDTH,
  palette: paletteOverride,
  style,
  ref,
}: AthleteCardFaceProps) => {
  const { card, palette, front, back, styles } = useCardModel(athlete, width, paletteOverride);
  const isBack = side === 'back';
  return (
    <View
      ref={ref}
      collapsable={false}
      accessible
      accessibilityRole="image"
      accessibilityLabel={describeCard(card, isBack)}
      style={[style, { width, height: cardHeightFor(width) }, styles.flat]}
    >
      <CardArt art={isBack ? back : front} />
      {isBack ? (
        <BackFace card={card} palette={palette} s={styles} hint={card.seasonLine} />
      ) : (
        <FrontFace card={card} palette={palette} s={styles} />
      )}
    </View>
  );
};

interface ShineProps {
  side: CardSide;
  x: SharedValue<number>;
  y: SharedValue<number>;
  opacity: SharedValue<number>;
  width: number;
  height: number;
}

const holoLine = gradientLine(cardShine.holoAngle);
/** Clear at both ends of the band, the holo colours in between. */
const HOLO_STOPS = [
  { offset: cardShine.holoStart, color: c.white, opacity: 0 },
  ...holoStops(),
  { offset: cardShine.holoEnd, color: c.white, opacity: 0 },
];

/**
 * Holo shine: a white hotspot plus an iridescent band, both following the finger. Static SVG
 * gradients moved with transforms, so it stays on the UI thread. The back face is turned 180°,
 * so it mirrors x.
 */
const Shine = ({ side, x, y, opacity, width, height }: ShineProps) => {
  const spot = Math.max(width, height) * cardShine.highlightRadius * 2;
  const holoW = width * cardShine.holoSpan;
  const holoH = height * cardShine.holoSpan;
  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const spotMove = useAnimatedStyle(() => {
    const fx = side === 'front' ? x.get() : 1 - x.get();
    return {
      transform: [
        { translateX: fx * width - spot / 2 },
        { translateY: y.get() * height - spot / 2 },
      ],
    };
  });
  // Same placement as CSS `background-position: x y` on an oversized layer.
  const holoMove = useAnimatedStyle(() => {
    const fx = side === 'front' ? x.get() : 1 - x.get();
    return {
      transform: [{ translateX: (width - holoW) * fx }, { translateY: (height - holoH) * y.get() }],
    };
  });
  const id = `${svgSafeId(useId())}${side}`;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fade]}>
      <Animated.View style={[shineStyles.layer, { width: holoW, height: holoH }, holoMove]}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={`${id}-holo`} {...holoLine}>
              {HOLO_STOPS.map((stop) => (
                <Stop
                  key={stop.offset}
                  offset={stop.offset}
                  stopColor={stop.color}
                  stopOpacity={stop.opacity}
                />
              ))}
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${id}-holo)`} />
        </Svg>
      </Animated.View>
      <Animated.View style={[shineStyles.layer, { width: spot, height: spot }, spotMove]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id={`${id}-spot`} cx="0.5" cy="0.5" r="0.5">
              <Stop
                offset={0}
                stopColor={cardShine.highlight.color}
                stopOpacity={cardShine.highlight.opacity}
              />
              <Stop offset={1} stopColor={cardShine.highlight.color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${id}-spot)`} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
};

const shineStyles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, top: 0 },
});

type Styles = ReturnType<typeof createStyles>;
interface FaceProps {
  card: PreparedCard;
  palette: CardPalette;
  s: Styles;
}

/** Team colour stripe across the top edge (decorative). */
const Stripe = ({ card, s }: { card: PreparedCard; s: Styles }) => (
  <View style={[s.stripe, { backgroundColor: card.teamColor }]} pointerEvents="none" />
);

/**
 * Rookie-card front from the Signing Day mockups: team stripe, jersey number over the photo,
 * name, position and team, then class, major and division.
 */
const FrontFace = ({ card, palette, s }: FaceProps) => {
  const fit = card.nameFit;
  const nameSize = {
    fontSize: fit.fontSize * s.k,
    lineHeight: fit.fontSize * NAME_LINE_HEIGHT * s.k,
  };
  return (
    <View style={s.fill}>
      <PhotoBleed uri={card.photoUri} palette={palette} />
      <View style={s.photoWindow}>
        {!card.photoUri && (
          <View style={s.placeholder}>
            <Text style={s.initials}>{card.initials}</Text>
          </View>
        )}
        {card.jerseyDigits && (
          <Text style={s.jersey} importantForAccessibility="no">
            {card.jerseyDigits}
          </Text>
        )}
        <Image
          source={teamImpactLogo}
          style={s.logo}
          resizeMode="contain"
          accessibilityLabel="Team Impact"
          accessibilityIgnoresInvertColors
        />
      </View>

      <View style={s.lower}>
        <View style={s.rookieTop}>
          {fit.lines.map((line, i) => (
            <Text
              key={i}
              style={[s.rookieName, nameSize]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {line}
            </Text>
          ))}
          {card.rookieLine.length > 0 && (
            <Text style={s.rookieLine} numberOfLines={1}>
              {card.rookieLine}
            </Text>
          )}
        </View>

        {card.rookieStats.length > 0 && (
          <View style={s.rookieRow}>
            {card.rookieStats.map((stat) => (
              <View key={stat.label} style={s.rookieCell}>
                <Text style={[s.statLabel, { color: c.yellow }]} numberOfLines={1}>
                  {stat.label}
                </Text>
                <Text style={[s.rookieValue, s.onDark]} numberOfLines={1}>
                  {stat.value}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <Stripe card={card} s={s} />
    </View>
  );
};

/** Back: who they are, experience rows, skills, about, facts and (when shared) contact. */
const BackFace = ({ card, palette, s, hint }: FaceProps & { hint: string | null }) => {
  const chips = [...card.skills, ...card.interests];
  return (
    <View style={s.fill}>
      <View style={s.content}>
        <View style={s.backHeader}>
          {card.photoUri ? (
            <Image
              source={{ uri: card.photoUri }}
              style={s.avatar}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={[s.avatar, s.avatarPlaceholder, { backgroundColor: palette.glow }]}>
              <Text style={[s.badgeNumber, s.onDark]}>{card.initials}</Text>
            </View>
          )}
          <View style={s.flex}>
            <Text style={[s.eyebrow, { color: c.yellow }]}>Off the field</Text>
            <Text style={[s.name, s.onDark]} numberOfLines={1} adjustsFontSizeToFit>
              {card.fullName}
            </Text>
            {card.personalLine.length > 0 && (
              <Text style={[s.subtle, s.onDarkMuted]} numberOfLines={1}>
                {card.personalLine}
              </Text>
            )}
          </View>
        </View>

        {card.experience.length > 0 && (
          <View style={s.section}>
            <Text style={[s.eyebrow, { color: palette.band }]}>Experience</Text>
            {card.experience.map((entry, i) => (
              <View key={`${i}-${entry.role}`} style={s.entry}>
                <View style={[s.entryBar, { backgroundColor: palette.band }]} />
                <Text style={[s.entryTitle, s.flex, { color: c.ink }]} numberOfLines={1}>
                  {entry.role}
                  {entry.organization ? (
                    <Text style={[s.entryMeta, { color: c.inkMuted }]}>
                      {' '}
                      · {entry.organization}
                    </Text>
                  ) : null}
                </Text>
                {entry.period ? (
                  <Text style={[s.entryMeta, { color: c.inkMuted }]} numberOfLines={1}>
                    {entry.period}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {chips.length > 0 && (
          <View style={s.chipRow}>
            {chips.map((chip, i) => (
              <Text
                key={`${i}-${chip}`}
                style={[s.chip, s.chipOnLight, { color: palette.band, borderColor: palette.band }]}
                numberOfLines={1}
              >
                {chip}
              </Text>
            ))}
          </View>
        )}

        {card.bio && (
          <View style={s.section}>
            <Text style={[s.eyebrow, { color: palette.band }]}>About</Text>
            <Text style={[s.body, { color: c.ink }]} numberOfLines={2}>
              {card.bio}
            </Text>
          </View>
        )}

        {card.facts.length > 0 && (
          <View style={s.facts}>
            {card.facts.map((fact) => (
              <View key={fact.label} style={s.fact}>
                <Text style={[s.statLabel, { color: c.inkMuted }]} numberOfLines={1}>
                  {fact.label}
                </Text>
                <Text style={[s.factValue, { color: c.ink }]} numberOfLines={1}>
                  {fact.value}
                </Text>
              </View>
            ))}
          </View>
        )}

        {card.contact.length > 0 && (
          <View style={[s.contact, { backgroundColor: palette.band }]}>
            {card.contact.map((line) => (
              <View key={line.label} style={s.contactLine}>
                <Text style={[s.statLabel, s.contactLabel, { color: c.yellow }]}>{line.label}</Text>
                <Text style={[s.entryMeta, s.onDark, s.flex]} numberOfLines={1}>
                  {line.value}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.spacer} />
        {hint ? <Text style={[s.footer, { color: c.inkMuted }]}>{hint}</Text> : null}
      </View>
      <Stripe card={card} s={s} />
    </View>
  );
};

const text = (variant: CardTextVariant, scale: number): TextStyle => {
  const spec: CardTextStyle = cardText[variant];
  return {
    fontSize: spec.fontSize * scale,
    lineHeight: spec.lineHeight * scale,
    // The display face is one weight; Android would fake-bold it if a weight were set too.
    ...(spec.display ? { fontFamily: displayFont.native } : { fontWeight: spec.fontWeight }),
    letterSpacing: (spec.letterSpacing ?? 0) * scale,
    textTransform: spec.uppercase ? 'uppercase' : 'none',
  };
};

const textShadow: TextStyle = {
  textShadowColor: withAlpha(c.ink, 0.45),
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 8,
};

// Mirrors createStyles in ../web/AthleteCard.tsx; keep the two in step.
const createStyles = (k: number) => {
  const photoBottom = (l.photoInset + l.photoHeight) * k;
  const styles = StyleSheet.create({
    face: {
      ...StyleSheet.absoluteFill,
      borderRadius: l.radius * k,
      backfaceVisibility: 'hidden',
      boxShadow: cardShadow,
    },
    clip: { flex: 1, borderRadius: l.radius * k, overflow: 'hidden' },
    flat: { borderRadius: l.radius * k, overflow: 'hidden' },
    fill: { flex: 1 },
    content: {
      flex: 1,
      padding: l.padding * k,
      gap: l.gap * k,
    },
    spacer: { flex: 1, marginTop: -l.gap * k },
    flex: { flex: 1, minWidth: 0 },
    onDark: { color: c.white },
    onDarkMuted: { color: withAlpha(c.white, 0.75) },
    eyebrow: text('eyebrow', k),
    stripe: { position: 'absolute', left: 0, right: 0, top: 0, height: l.stripe * k },

    photoWindow: {
      position: 'absolute',
      left: l.photoInset * k,
      right: l.photoInset * k,
      top: l.photoInset * k,
      height: l.photoHeight * k,
    },
    placeholder: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
    initials: { ...text('initials', k), color: withAlpha(c.white, 0.92) },
    jersey: {
      ...text('jersey', k),
      ...textShadow,
      position: 'absolute',
      left: l.jerseyInsetX * k,
      top: l.jerseyInsetY * k,
      color: c.white,
    },
    logo: {
      position: 'absolute',
      right: 10 * k,
      top: 10 * k,
      height: l.logoHeight * k,
      width: l.logoHeight * l.logoAspect * k,
    },
    badgeNumber: { ...text('badgeNumber', k), color: c.navyDeep },

    lower: {
      position: 'absolute',
      left: l.lowerPaddingX * k,
      right: l.lowerPaddingX * k,
      top: photoBottom + l.lowerPaddingY * k,
      bottom: (l.lowerPaddingY + 4) * k,
      justifyContent: 'space-between',
    },
    rookieTop: { gap: l.rookieGap * k },
    rookieName: { ...text('rookieName', k), ...textShadow, color: c.white },
    rookieLine: { ...text('rookieLine', k), color: c.white },
    rookieRow: {
      flexDirection: 'row',
      gap: 10 * k,
      paddingTop: l.rookieRowPadding * k,
      borderTopWidth: 1,
      borderTopColor: withAlpha(c.white, 0.18),
    },
    rookieCell: { flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 * k },
    rookieValue: text('rookieValue', k),
    subtle: text('subtle', k),
    statLabel: text('statLabel', k),

    section: { gap: 4 * k },
    entry: { flexDirection: 'row', gap: 8 * k, alignItems: 'center' },
    entryBar: { width: 3 * k, height: 12 * k, borderRadius: 2 * k },
    entryTitle: text('entryTitle', k),
    entryMeta: text('entryMeta', k),

    // One row of whole chips: extras wrap onto a clipped second row rather than squashing.
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6 * k,
      height: (cardText.chip.lineHeight + l.chipPaddingY * 2) * k + 2,
      overflow: 'hidden',
    },
    chip: {
      ...text('chip', k),
      paddingHorizontal: l.chipPaddingX * k,
      paddingVertical: l.chipPaddingY * k,
      borderRadius: l.chipRadius,
      borderWidth: 1,
      overflow: 'hidden',
    },
    chipOnLight: { backgroundColor: withAlpha(c.white, 0.6) },
    footer: { ...text('footer', k), textAlign: 'center' },

    backHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12 * k,
      paddingRight: 8 * k,
      height: l.backHeader * k,
    },
    avatar: {
      width: l.avatar * k,
      height: l.avatar * k,
      borderRadius: (l.avatar * k) / 2,
      borderWidth: l.photoBorder * k,
      borderColor: c.white,
    },
    avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    name: text('name', k),
    body: text('body', k),
    facts: { flexDirection: 'row', gap: 6 * k },
    fact: {
      flex: 1,
      minWidth: 0,
      backgroundColor: withAlpha(c.white, 0.72),
      borderRadius: l.tileRadius * k,
      paddingHorizontal: 10 * k,
      paddingVertical: 7 * k,
      gap: 2 * k,
    },
    factValue: text('factValue', k),
    contact: {
      borderRadius: l.tileRadius * k,
      paddingHorizontal: 12 * k,
      paddingVertical: 8 * k,
      gap: 3 * k,
    },
    contactLine: { flexDirection: 'row', alignItems: 'center', gap: 10 * k },
    contactLabel: { width: l.contactLabel * k },
  });
  return { ...styles, k };
};
