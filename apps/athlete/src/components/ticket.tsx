import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, spacing } from '@team-impact/ui-tokens';
import { monthDay } from '@/components/format';
import { ease, haptics, Text, timing, useReducedMotion, withAlpha } from '@/ui';

/** How long the stub takes to tear off and fall away (approved concept). */
const TEAR_MS = 560;
/** Radius of the perforation notches where the stub meets the ticket. */
const NOTCH = spacing.sm;
/** Dashes in the perforated divider. */
const DASHES = 6;
/** Fades are the reduced-motion fallback, so they run even when the system asks for less motion. */
const FADE = { ...timing.small, reduceMotion: ReduceMotion.Never };

/**
 * "Ticket RSVP": the Going answer as a ticket with a perforated stub. Tapping it tears the stub
 * off (it tips and falls away, ease.cardDeal) and the ticket turns success green and reads Going;
 * tapping again gives the seat back. Haptics: commit on the tear, a selection tick on undo.
 * Reduced motion: the stub fades instead of falling; the colour change is a fade either way.
 *
 * The notches are circles in the `ground` colour over the seam (no masks on native), so pass the
 * colour the ticket sits on. `onNavy` is for a navy hero: the ticket goes a shade deeper.
 */
export function TicketRsvp({
  kicker,
  title,
  going,
  onToggle,
  ground = colors.ground,
  onNavy,
  disabled,
}: {
  /** The event's date and place, e.g. "Sat Oct 25 · Bello Field". */
  kicker: string;
  title: string;
  going: boolean;
  onToggle: (going: boolean) => void;
  ground?: string;
  onNavy?: boolean;
  disabled?: boolean;
}) {
  const reduced = useReducedMotion();
  const tear = useSharedValue(going ? 1 : 0);
  const green = useSharedValue(going ? 1 : 0);
  const was = useRef(going);
  const tone = onNavy ? colors.card.art.navyDeep : colors.brand;

  useEffect(() => {
    if (was.current === going) return;
    was.current = going;
    green.value = withTiming(going ? 1 : 0, FADE);
    if (!going)
      tear.value = 0; // the stub is back, as if never torn
    else if (reduced) tear.value = withTiming(1, FADE);
    else tear.value = withTiming(1, { duration: TEAR_MS, easing: ease.cardDeal });
  }, [going, reduced, tear, green]);

  const mainStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(green.value, [0, 1], [tone, colors.success.text]),
  }));
  const stubStyle = useAnimatedStyle(() => {
    if (reduced) return { opacity: 1 - tear.value, transform: [] };
    const t = tear.value;
    return {
      opacity: interpolate(t, [0, 0.35, 1], [1, 1, 0]),
      transform: [
        { translateX: interpolate(t, [0, 0.35, 1], [0, 4, 30]) },
        { translateY: interpolate(t, [0, 0.35, 1], [0, -2, 50]) },
        { rotate: `${interpolate(t, [0, 0.35, 1], [0, 9, 28])}deg` },
      ],
    };
  });

  const press = () => {
    const next = !going;
    if (next) haptics.commit();
    else haptics.select();
    onToggle(next);
  };
  const notch = { backgroundColor: ground };

  return (
    <Pressable
      onPress={press}
      disabled={disabled}
      accessibilityRole="button"
      // The label changes too, so the answer is never said by colour or motion alone.
      accessibilityLabel={`${going ? 'You’re going' : 'Going'}, ${title}, ${kicker}`}
      accessibilityHint={going ? 'Tap again to give your seat back.' : undefined}
      accessibilityState={{ selected: going, disabled: !!disabled }}
      style={[styles.ticket, disabled && styles.disabled]}
    >
      <Animated.View style={[styles.main, mainStyle]}>
        <Text variant="eyebrow" color="onBrandSecondary" numberOfLines={1}>
          {kicker}
        </Text>
        <Text
          variant="display"
          size="xs"
          color="onBrand"
          accessibilityRole="none"
          numberOfLines={2}
        >
          {going ? 'Going' : 'RSVP'} · {title}
        </Text>
        <View style={[styles.notch, styles.notchTopMain, notch]} />
        <View style={[styles.notch, styles.notchBottomMain, notch]} />
      </Animated.View>
      <Animated.View style={[styles.stub, { backgroundColor: tone }, stubStyle]} aria-hidden>
        <View style={styles.perforation}>
          {Array.from({ length: DASHES }, (_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </View>
        <Text variant="eyebrow" color="onBrandSecondary">
          Admit
        </Text>
        <Text variant="display" size="sm" style={styles.admit} accessibilityRole="none">
          1
        </Text>
        <View style={[styles.notch, styles.notchTopStub, notch]} />
        <View style={[styles.notch, styles.notchBottomStub, notch]} />
      </Animated.View>
    </Pressable>
  );
}

/** The ticket's kicker line: "Sat Oct 25 · Bello Field". */
export const ticketKicker = (startsAt: string, location: string) => {
  const d = monthDay(startsAt);
  return `${d.weekday} ${d.month.charAt(0)}${d.month.slice(1).toLowerCase()} ${d.day} · ${location}`;
};

const styles = StyleSheet.create({
  // Above its siblings, so the torn stub falls in front of the buttons below it.
  ticket: { flexDirection: 'row', alignSelf: 'stretch', minHeight: spacing['3xl'], zIndex: 1 },
  main: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xs / 2,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.md,
    borderTopLeftRadius: radius.md,
    borderBottomLeftRadius: radius.md,
  },
  stub: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopRightRadius: radius.md,
    borderBottomRightRadius: radius.md,
    transformOrigin: 'left bottom',
  },
  admit: { color: colors.card.art.yellow },
  perforation: {
    position: 'absolute',
    left: -1,
    top: NOTCH + spacing.xs,
    bottom: NOTCH + spacing.xs,
    justifyContent: 'space-between',
  },
  dash: {
    width: 2,
    height: spacing.xs,
    backgroundColor: withAlpha(colors.onBrand.text, 0.5),
  },
  notch: { position: 'absolute', width: NOTCH * 2, height: NOTCH * 2, borderRadius: NOTCH },
  notchTopMain: { top: -NOTCH, right: -NOTCH },
  notchBottomMain: { bottom: -NOTCH, right: -NOTCH },
  notchTopStub: { top: -NOTCH, left: -NOTCH },
  notchBottomStub: { bottom: -NOTCH, left: -NOTCH },
  disabled: { opacity: 0.4 },
});
