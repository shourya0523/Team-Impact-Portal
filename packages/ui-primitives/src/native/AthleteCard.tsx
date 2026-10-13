import { useEffect, useMemo } from 'react';
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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
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
import { backArt, frontArt } from '../athlete-card/patterns';
import {
  CARD_WIDTH,
  cardColors as c,
  cardHeightFor,
  cardLayout as l,
  cardMotion,
  cardShadow,
  cardText,
  type CardTextStyle,
  type CardTextVariant,
} from '../athlete-card/spec';
import type { AthleteCardData } from '../athlete-card/types';
import teamImpactLogo from '../../assets/team-impact-logo.png';
import { CardArt, PhotoBleed } from './CardArt';
import { samplePhoto } from './samplePhoto';

export interface AthleteCardProps {
  athlete: AthleteCardData;
  /** Card width in points; height follows the 5:7 aspect ratio. */
  width?: number;
  /** Controlled flip state. Omit to let the card manage it. */
  flipped?: boolean;
  defaultFlipped?: boolean;
  onFlippedChange?: (flipped: boolean) => void;
  /** Skip photo sampling, e.g. when the palette was computed once and stored with the profile. */
  palette?: CardPalette;
  style?: StyleProp<ViewStyle>;
}

const flipEasing = Easing.bezier(...cardMotion.easing);
const flipSpring = { damping: 18, stiffness: 160, mass: 1 };

/**
 * Baseball-style athlete card: resume on the front, personal info on the back. Swipe sideways to
 * turn it (it follows the finger and settles on release), or tap to flip. Colours come from the
 * photo. Gesture and animation run on the UI thread; React only hears about settled flips.
 */
export const AthleteCard = ({
  athlete,
  width = CARD_WIDTH,
  flipped,
  defaultFlipped,
  onFlippedChange,
  palette: paletteOverride,
  style,
}: AthleteCardProps) => {
  const card = useMemo(() => prepareCard(athlete), [athlete]);
  const palette = useCardPalette(card.photoUri, paletteOverride, samplePhoto);
  const front = useMemo(() => frontArt(card.seed, palette), [card.seed, palette]);
  const back = useMemo(() => backArt(card.seed, palette), [card.seed, palette]);
  const styles = useMemo(() => createStyles(width / CARD_WIDTH), [width]);
  const [isFlipped, setFlipped] = useFlipState(flipped, defaultFlipped, onFlippedChange);
  const reduceMotion = useReducedMotion();

  const angle = useSharedValue(isFlipped ? 180 : 0);
  const restAngle = useSharedValue(isFlipped ? 180 : 0);
  const dragStart = useSharedValue(0);
  const pressed = useSharedValue(1);

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
    const pan = Gesture.Pan()
      .activeOffsetX([-10, 10])
      .failOffsetY([-14, 14])
      .onStart(() => {
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
  }, [width, reduceMotion, angle, restAngle, dragStart, pressed, setFlipped]);

  const liftStyle = useAnimatedStyle(() => ({
    transform: [{ scale: (1 + (cardMotion.lift - 1) * edgeAmount(angle.get())) * pressed.get() }],
  }));
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

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={describeCard(card, isFlipped)}
        accessibilityHint="Swipe sideways or double tap to flip the card"
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={onAccessibilityAction}
        style={[style, { width, height: cardHeightFor(width) }, liftStyle]}
      >
        <Animated.View style={[styles.face, frontStyle]} pointerEvents="none">
          <View style={styles.clip}>
            <CardArt art={front} />
            <FrontFace card={card} palette={palette} s={styles} />
          </View>
        </Animated.View>
        <Animated.View style={[styles.face, backStyle]} pointerEvents="none">
          <View style={styles.clip}>
            <CardArt art={back} />
            <BackFace card={card} palette={palette} s={styles} />
          </View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};

type Styles = ReturnType<typeof createStyles>;
interface FaceProps {
  card: PreparedCard;
  palette: CardPalette;
  s: Styles;
}

const FrontFace = ({ card, palette, s }: FaceProps) => (
  <View style={s.fill}>
    <PhotoBleed uri={card.photoUri} palette={palette} />
    <View style={s.photoWindow}>
      {!card.photoUri && (
        <View style={s.placeholder}>
          <Text style={s.initials}>{card.initials}</Text>
        </View>
      )}
      <View style={s.photoTop}>
        <Image
          source={teamImpactLogo}
          style={s.logo}
          resizeMode="contain"
          accessibilityLabel="Team Impact"
          accessibilityIgnoresInvertColors
        />
        {card.jerseyNumber && (
          <View style={s.jerseyBadge}>
            <Text style={s.badgeNumber}>{card.jerseyNumber}</Text>
          </View>
        )}
      </View>
      <View style={s.nameplate}>
        <Text style={[s.firstName, s.onDark]} numberOfLines={1}>
          {card.firstName}
        </Text>
        <Text style={[s.lastName, s.onDark]} numberOfLines={1} adjustsFontSizeToFit>
          {card.lastName}
        </Text>
      </View>
    </View>

    {card.positionBadge && (
      <View style={[s.positionBadge, { borderColor: palette.deep }]}>
        <Text style={s.badgeText}>{card.positionBadge}</Text>
      </View>
    )}

    <View style={s.lower}>
      <Text style={[s.eyebrow, s.teamLine]} numberOfLines={1}>
        {card.teamLine}
      </Text>

      {card.stats.length > 0 && (
        <View style={s.stats}>
          {card.stats.map((stat, i) => (
            <View key={stat.label} style={[s.stat, i > 0 && s.statDivider]}>
              <Text style={[s.statValue, s.onDark]} numberOfLines={1}>
                {stat.value}
              </Text>
              <Text style={[s.statLabel, s.onDarkMuted]} numberOfLines={1}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={s.section}>
        <Text style={[s.eyebrow, { color: c.yellow }]}>Experience</Text>
        {card.experience.map((entry) => (
          <View key={`${entry.role}-${entry.organization}`} style={s.entry}>
            <View style={s.entryBar} />
            <Text style={[s.entryTitle, s.onDark, s.flex]} numberOfLines={1}>
              {entry.role}
              <Text style={[s.entryMeta, s.onDarkMuted]}> · {entry.organization}</Text>
            </Text>
            <Text style={[s.entryMeta, s.onDarkFaint]} numberOfLines={1}>
              {entry.period}
            </Text>
          </View>
        ))}
      </View>

      <View style={s.skills}>
        {card.skills.map((skill) => (
          <Text key={skill} style={[s.chip, s.chipOnDark]} numberOfLines={1}>
            {skill}
          </Text>
        ))}
      </View>
    </View>
  </View>
);

const BackFace = ({ card, palette, s }: FaceProps) => (
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

    {card.bio && (
      <View style={s.section}>
        <Text style={[s.eyebrow, { color: palette.band }]}>About</Text>
        <Text style={[s.body, { color: c.ink }]} numberOfLines={3}>
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

    <View style={s.chips}>
      {card.interests.map((interest) => (
        <Text
          key={interest}
          style={[s.chip, s.chipOnLight, { color: palette.band, borderColor: palette.band }]}
          numberOfLines={1}
        >
          {interest}
        </Text>
      ))}
    </View>

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

    <Text style={[s.footer, { color: c.inkMuted }]}>Swipe or tap to flip ↻</Text>
  </View>
);

const text = (variant: CardTextVariant, scale: number): TextStyle => {
  const spec: CardTextStyle = cardText[variant];
  return {
    fontSize: spec.fontSize * scale,
    lineHeight: spec.lineHeight * scale,
    fontWeight: spec.fontWeight,
    letterSpacing: (spec.letterSpacing ?? 0) * scale,
    textTransform: spec.uppercase ? 'uppercase' : 'none',
  };
};

// Mirrors createStyles in ../web/AthleteCard.tsx; keep the two in step.
const createStyles = (k: number) => {
  const photoBottom = (l.photoInset + l.photoHeight) * k;
  return StyleSheet.create({
    face: {
      ...StyleSheet.absoluteFill,
      borderRadius: l.radius * k,
      backfaceVisibility: 'hidden',
      boxShadow: cardShadow,
    },
    clip: { flex: 1, borderRadius: l.radius * k, overflow: 'hidden' },
    fill: { flex: 1 },
    content: {
      flex: 1,
      padding: l.padding * k,
      gap: l.gap * k,
      justifyContent: 'space-between',
    },
    flex: { flex: 1, minWidth: 0 },
    onDark: { color: c.white },
    onDarkMuted: { color: 'rgba(255,255,255,0.75)' },
    onDarkFaint: { color: 'rgba(255,255,255,0.55)' },
    eyebrow: text('eyebrow', k),

    photoWindow: {
      position: 'absolute',
      left: l.photoInset * k,
      right: l.photoInset * k,
      top: l.photoInset * k,
      height: l.photoHeight * k,
    },
    placeholder: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
    initials: { ...text('initials', k), color: 'rgba(255,255,255,0.92)' },
    photoTop: {
      position: 'absolute',
      left: 10 * k,
      right: 10 * k,
      top: 10 * k,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    logo: {
      height: l.logoHeight * k,
      width: l.logoHeight * l.logoAspect * k,
    },
    jerseyBadge: {
      width: l.jerseyBadge * k,
      height: l.jerseyBadge * k,
      borderRadius: l.jerseyBadge * k,
      backgroundColor: c.yellow,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeNumber: { ...text('badgeNumber', k), color: c.navyDeep },
    nameplate: {
      position: 'absolute',
      left: 14 * k,
      right: (l.positionBadge + 22) * k,
      bottom: 12 * k,
    },
    firstName: text('firstName', k),
    lastName: text('lastName', k),
    positionBadge: {
      position: 'absolute',
      right: (l.photoInset + 14) * k,
      top: photoBottom - (l.positionBadge / 2) * k,
      width: l.positionBadge * k,
      height: l.positionBadge * k,
      borderRadius: l.positionBadge * k,
      borderWidth: l.photoBorder * k,
      backgroundColor: c.yellow,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { ...text('badge', k), color: c.navyDeep },

    lower: {
      position: 'absolute',
      left: l.lowerPaddingX * k,
      right: l.lowerPaddingX * k,
      top: photoBottom + l.lowerPaddingY * k,
      bottom: (l.lowerPaddingY + 2) * k,
      justifyContent: 'space-between',
    },
    teamLine: { color: c.yellow, paddingRight: (l.positionBadge + 4) * k },
    subtle: text('subtle', k),
    stats: {
      flexDirection: 'row',
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderColor: 'rgba(255,255,255,0.14)',
      borderWidth: 1,
      borderRadius: l.tileRadius * k,
      paddingVertical: 7 * k,
    },
    stat: { flex: 1, alignItems: 'center' },
    statDivider: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.14)' },
    statValue: text('statValue', k),
    statLabel: text('statLabel', k),

    section: { gap: 4 * k },
    entry: { flexDirection: 'row', gap: 8 * k, alignItems: 'center' },
    entryBar: { width: 3 * k, height: 12 * k, borderRadius: 2 * k, backgroundColor: c.yellow },
    entryTitle: text('entryTitle', k),
    entryMeta: text('entryMeta', k),

    // One row of whole chips: extras wrap onto a clipped second row rather than squashing.
    skills: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6 * k,
      height: (cardText.chip.lineHeight + l.chipPaddingY * 2) * k + 2,
      overflow: 'hidden',
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 * k },
    chip: {
      ...text('chip', k),
      paddingHorizontal: l.chipPaddingX * k,
      paddingVertical: l.chipPaddingY * k,
      borderRadius: l.chipRadius,
      borderWidth: 1,
      overflow: 'hidden',
    },
    chipOnDark: { color: c.white, borderColor: 'rgba(255,255,255,0.32)' },
    chipOnLight: { backgroundColor: 'rgba(255,255,255,0.6)' },
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
    facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 * k },
    fact: {
      width: '48.5%',
      flexGrow: 1,
      backgroundColor: 'rgba(255,255,255,0.72)',
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
};
