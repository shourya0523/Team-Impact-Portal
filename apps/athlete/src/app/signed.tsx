import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, duration, radius, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { shortDate } from '@/components/format';
import { Progress } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { firstTab } from '@/navigation/tabs';
import {
  Button,
  FadeSlideIn,
  TeamAvatar,
  Text,
  springConfig,
  timing,
  useReducedMotion,
} from '@/ui';

const STAMP_BORDER = 6;
/** The stamp drops in large and tilted, then settles at a slight angle. */
const STAMP_FROM = { scale: 2.2, rotate: -14 };
const STAMP_REST = -8;

/**
 * The SIGNED stamp: lands with the earned-moment spring. Under reduced motion there is no stamp
 * movement at all, only a fade.
 */
function Stamp({ date }: { date: string }) {
  const reduced = useReducedMotion();
  const land = useSharedValue(0);
  const fade = useSharedValue(0);
  useEffect(() => {
    fade.value = withTiming(1, reduced ? timing.screen : timing.small);
    land.value = reduced ? 1 : withSpring(1, springConfig);
  }, [reduced, fade, land]);
  const style = useAnimatedStyle(() => {
    const scale = STAMP_FROM.scale + (1 - STAMP_FROM.scale) * land.value;
    const rotate = STAMP_FROM.rotate + (STAMP_REST - STAMP_FROM.rotate) * land.value;
    return {
      opacity: fade.value,
      transform: reduced
        ? [{ rotate: `${STAMP_REST}deg` }]
        : [{ scale }, { rotate: `${rotate}deg` }],
    };
  });
  return (
    <Animated.View style={[styles.stamp, style]} accessible accessibilityLabel={`Signed, ${date}`}>
      <Text variant="display" size="xxl" color="onBrand" accessibilityRole="none">
        Signed
      </Text>
      <Text variant="eyebrow" color="onBrand">
        {date}
      </Text>
    </Animated.View>
  );
}

/**
 * "/signed": you're on the team. QR joins land here at once; join requests land here when the
 * pending screen sees the coach's approval. `?teamId=` names the team (else the newest one).
 */
export default function Signed() {
  const params = useLocalSearchParams<{ teamId?: string; teamName?: string }>();
  const { role, me } = useRole();
  const insets = useSafeAreaInsets();
  const teamId = params.teamId || me?.teamIds.at(-1) || null;
  const roster = useApi(
    () => (teamId ? api.roster(teamId).then((r) => r.team) : Promise.resolve(null)),
    [teamId],
  );
  const team = roster.state.status === 'ready' ? roster.state.data : null;
  const teamLabel = team ? `${team.college.name.split(' ')[0]} ${team.name}` : params.teamName;
  const date = shortDate(new Date().toISOString()).toUpperCase();

  const next = () => {
    if (!role) return router.replace('/sign-up');
    router.replace(firstTab(role));
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, title: 'Signed' }} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        <Progress step={3} total={3} onNavy />
        <View style={styles.hero}>
          <Stamp date={date} />
          <FadeSlideIn delay={duration.stamp}>
            <View style={styles.welcome}>
              {team && <TeamAvatar name={team.name} teamColor={team.color} size="lg" />}
              <Text variant="display" size="lg" color="onBrand" style={styles.center}>
                {teamLabel ? `Welcome to ${teamLabel}` : 'Welcome to the team'}
              </Text>
              <Text color="onBrandSecondary" style={styles.center}>
                {team
                  ? `You’re on the roster at ${team.college.name}. The team feed, roster and events are open to you now.`
                  : 'You’re on the roster. The team feed, roster and events are open to you now.'}
              </Text>
              {roster.state.status === 'error' && (
                <Text weight="semibold" color="onBrand" accessibilityRole="alert">
                  Couldn’t load the team: {roster.state.error.message}
                </Text>
              )}
            </View>
          </FadeSlideIn>
        </View>
        <FadeSlideIn delay={duration.stamp}>
          <View style={styles.actions}>
            {role === 'athlete' && (
              <Button
                label="Make your Baseball Card"
                variant="onBrand"
                size="lg"
                onPress={() => router.replace('/card')}
              />
            )}
            {role === 'parent' && (
              <Button
                label="Set up your child’s profile"
                variant="onBrand"
                size="lg"
                onPress={() => router.replace('/child')}
              />
            )}
            <Button
              label="Enter the app"
              variant={role === 'athlete' || role === 'parent' ? 'ghostOnBrand' : 'onBrand'}
              size="lg"
              onPress={next}
            />
          </View>
        </FadeSlideIn>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.brand },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, gap: spacing.lg },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing['2xl'] },
  stamp: {
    borderWidth: STAMP_BORDER,
    borderColor: colors.onBrand.text,
    borderRadius: radius.card,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  welcome: { alignItems: 'center', gap: spacing.sm },
  center: { textAlign: 'center' },
  actions: { gap: spacing.sm },
});
