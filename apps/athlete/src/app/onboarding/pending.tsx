import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@team-impact/ui-tokens';
import { errorMessage } from '@/components/signup';
import { Progress } from '@/components/ui';
import { api } from '@/api';
import { useRole } from '@/navigation/role';
import { Button, Icon, Text } from '@/ui';

const DOT = 24;
/** How often the screen asks whether the coach has approved, while it's open. */
const POLL_MS = 15_000;
const CHECK = 64;

function Step({
  title,
  note,
  state,
}: {
  title: string;
  note: string;
  state: 'done' | 'now' | 'next';
}) {
  return (
    <View style={styles.step}>
      <View style={styles.rail}>
        {state === 'done' ? (
          <View style={[styles.dot, { backgroundColor: colors.surface }]}>
            <Icon name="check" size={14} color={colors.brand} strokeWidth={3.4} />
          </View>
        ) : (
          <View style={[styles.dot, state === 'now' ? styles.dotNow : styles.dotNext]} />
        )}
        {state !== 'next' && (
          <View
            style={[
              styles.line,
              { backgroundColor: state === 'done' ? colors.onBrand.muted : colors.brandRaised },
            ]}
          />
        )}
      </View>
      <View style={styles.stepText}>
        <Text weight="semibold" color={state === 'next' ? 'onBrandSecondary' : 'onBrand'}>
          {title}
        </Text>
        <Text variant="caption" color={state === 'next' ? 'onBrandMuted' : 'onBrandSecondary'}>
          {note}
        </Text>
      </View>
    </View>
  );
}

/**
 * "/onboarding/pending": waiting on the coach. While open it re-reads `/me` every so often (and on
 * "Check again"); once the team is in `teamIds`, the coach approved and the Signed screen takes over.
 */
export default function Pending() {
  const { teamName, teamId } = useLocalSearchParams<{ teamName?: string; teamId?: string }>();
  const { me, setMe } = useRole();
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Without a team id (an older link), any team that wasn't there when we arrived counts.
  const known = useRef(me?.teamIds ?? []);

  const check = useCallback(
    (byHand: boolean) => {
      if (byHand) {
        setChecking(true);
        setNote(null);
        setError(null);
      }
      return api.me().then(
        (updated) => {
          const approved = teamId
            ? updated.teamIds.includes(teamId)
            : updated.teamIds.some((t) => !known.current.includes(t));
          setChecking(false);
          if (approved) {
            setMe(updated);
            router.replace({
              pathname: '/signed',
              params: { teamId: teamId ?? updated.teamIds.at(-1) ?? '', teamName: teamName ?? '' },
            });
          } else if (byHand) {
            setNote('Not yet. The coach hasn’t answered, so hang tight.');
          }
        },
        (e: unknown) => {
          setChecking(false);
          if (byHand) setError(errorMessage(e));
        },
      );
    },
    [teamId, teamName, setMe],
  );

  useEffect(() => {
    const timer = setInterval(() => void check(false), POLL_MS);
    void check(false);
    return () => clearInterval(timer);
  }, [check]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}>
        <Progress step={3} total={3} onNavy />
        <View style={styles.hero}>
          <View style={styles.check}>
            <Icon name="check" size={30} color={colors.onBrand.text} strokeWidth={3} />
          </View>
          <Text variant="display" size="xxl" color="onBrand">
            Request{'\n'}sent
          </Text>
          <Text color="onBrandSecondary">
            The coach has your request to join {teamName ?? 'the team'}. We’ll tell you the moment
            it’s approved.
          </Text>
        </View>
        <View>
          <Step title="Request sent" note="Just now" state="done" />
          <Step title="Coach reviews it" note="Usually within a day or two" state="now" />
          <Step title="You’re on the team" note="Roster, feed and events open up" state="next" />
        </View>
        <View style={styles.grow} />
        {note && (
          <Text color="onBrandSecondary" accessibilityRole="alert">
            {note}
          </Text>
        )}
        {error && (
          <Text weight="semibold" color="onBrand" accessibilityRole="alert">
            Couldn’t check: {error}
          </Text>
        )}
        <Button
          label={checking ? 'Checking…' : 'Check again'}
          variant="onBrand"
          size="lg"
          disabled={checking}
          onPress={() => void check(true)}
        />
        <Button
          label="Have the coach’s QR? Scan it"
          variant="ghostOnBrand"
          size="lg"
          onPress={() => router.push('/scan')}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.brand },
  content: { flexGrow: 1, padding: spacing.lg, gap: spacing.lg },
  hero: { marginTop: spacing['2xl'], gap: spacing.sm },
  check: {
    width: CHECK,
    height: CHECK,
    borderRadius: CHECK / 2,
    backgroundColor: colors.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
  step: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center' },
  stepText: { paddingTop: spacing.xs },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotNow: { borderWidth: 3, borderColor: colors.surface },
  dotNext: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.onBrand.muted },
  line: { width: 2, height: 28 },
  grow: { flex: 1 },
});
