import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * The app's haptic vocabulary, so every screen feels the same. Light for taps, a tick for
 * selection, Medium for commitments, Heavy only when something lands, notifications for outcomes.
 * Android uses its own haptic constants (no Vibrator, no VIBRATE permission); web does nothing.
 * Haptics aren't motion, so they still play under reduced motion; the OS setting turns them off.
 */
type Moment = keyof typeof IOS;

const { ImpactFeedbackStyle: Impact, NotificationFeedbackType: Note, AndroidHaptics: A } = Haptics;

const IOS = {
  /** Any button pressed in. */
  tap: () => Haptics.impactAsync(Impact.Light),
  /** A switch, chip, tab or filter changed; a hold passing a quarter. */
  select: () => Haptics.selectionAsync(),
  /** Something committed: a ticket torn. */
  commit: () => Haptics.impactAsync(Impact.Medium),
  /** Something landed: the SIGNED stamp, a member removed. */
  land: () => Haptics.impactAsync(Impact.Heavy),
  /** A swipe crossed the line where letting go will act. */
  edge: () => Haptics.impactAsync(Impact.Rigid),
  success: () => Haptics.notificationAsync(Note.Success),
  warning: () => Haptics.notificationAsync(Note.Warning),
  error: () => Haptics.notificationAsync(Note.Error),
};

const ANDROID: Record<Moment, Haptics.AndroidHaptics> = {
  tap: A.Virtual_Key,
  select: A.Segment_Tick,
  commit: A.Context_Click,
  land: A.Long_Press,
  edge: A.Segment_Frequent_Tick,
  success: A.Confirm,
  warning: A.Reject,
  error: A.Reject,
};

const play = (moment: Moment) => {
  if (Platform.OS === 'web') return;
  const run =
    Platform.OS === 'android'
      ? () => Haptics.performAndroidHapticsAsync(ANDROID[moment])
      : IOS[moment];
  // A missing Taptic Engine, low power mode or an old OS just means no buzz.
  void run().catch(() => undefined);
};

/** Gap between the two taps of a Rally, like two claps. */
const CLAP_GAP_MS = 60;

export const haptics = {
  tap: () => play('tap'),
  select: () => play('select'),
  commit: () => play('commit'),
  land: () => play('land'),
  edge: () => play('edge'),
  success: () => play('success'),
  warning: () => play('warning'),
  error: () => play('error'),
  /** Rally: two light taps. */
  clap: () => {
    play('tap');
    setTimeout(() => play('tap'), CLAP_GAP_MS);
  },
};
