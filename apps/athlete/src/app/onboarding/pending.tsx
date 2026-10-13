import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { Button, Progress } from '@/components/ui';
import { c, font } from '@/theme';

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
    <View style={{ flexDirection: 'row', gap: 14 }}>
      <View style={{ alignItems: 'center' }}>
        {state === 'done' ? (
          <View style={[styles.dot, { backgroundColor: '#fff' }]}>
            <Icon name="check" size={14} color={c.navy} strokeWidth={3.4} />
          </View>
        ) : (
          <View style={[styles.dot, state === 'now' ? styles.dotNow : styles.dotNext]} />
        )}
        {state !== 'next' && (
          <View
            style={[
              styles.line,
              { backgroundColor: state === 'done' ? c.onNavyMuted : c.navyRaised },
            ]}
          />
        )}
      </View>
      <View style={{ paddingTop: 2 }}>
        <Text
          style={{
            fontFamily: font.bold,
            fontSize: 15,
            color: state === 'next' ? c.onNavy : '#fff',
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: font.body,
            fontSize: 13,
            color: state === 'next' ? c.onNavyMuted : c.onNavy,
          }}
        >
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
    <View style={{ flex: 1, backgroundColor: c.navy }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: insets.top + 28, gap: 24 }}
      >
        <Progress step={3} total={3} onNavy />
        <View style={{ marginTop: 48, gap: 10 }}>
          <View style={styles.check}>
            <Icon name="check" size={30} color="#fff" strokeWidth={3} />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            REQUEST{'\n'}SENT
          </Text>
          <Text style={styles.body}>
            The coach has your request to join {teamName ?? 'the team'}. We’ll tell you the moment
            it’s approved.
          </Text>
        </View>
        <View>
          <Step title="Request sent" note="Just now" state="done" />
          <Step title="Coach reviews it" note="Usually within a day or two" state="now" />
          <Step title="You’re on the team" note="Roster, feed and events open up" state="next" />
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ gap: 10 }}>
          <Button
            label="Have the coach’s QR? Scan it"
            kind="onNavy"
            size="lg"
            onPress={() => router.push('/scan')}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  check: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: font.display, fontSize: 56, lineHeight: 52, color: '#fff' },
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 23, color: c.navyTint },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dotNow: { borderWidth: 3, borderColor: '#fff' },
  dotNext: { borderWidth: 2, borderStyle: 'dashed', borderColor: c.onNavyMuted },
  line: { width: 2, height: 28 },
});
