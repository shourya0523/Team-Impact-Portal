import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@team-impact/ui-tokens';
import { Progress } from '@/components/ui';
import { Button, Icon, Text } from '@/ui';

const DOT = 24;
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

/** "/onboarding/pending": waiting on the coach. */
export default function Pending() {
  const { teamName } = useLocalSearchParams<{ teamName?: string }>();
  const insets = useSafeAreaInsets();
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
