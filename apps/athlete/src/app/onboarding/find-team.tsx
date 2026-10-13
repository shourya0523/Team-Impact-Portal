import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { College, TeamSummary } from '@team-impact/contracts';
import { api } from '@/api';
import { Icon } from '@/components/Icon';
import { Async, Button, Card, Progress, type } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { c, font, monogram } from '@/theme';

/** For teams that aren't registered yet (PRD §3, P7). */
const askForTeam = (college: College) =>
  Linking.openURL(
    `mailto:appdev@teamimpact.org?subject=${encodeURIComponent(`Add my team: ${college.name}`)}&body=${encodeURIComponent(
      `College: ${college.name}\nSport: `,
    )}`,
  );

function CollegeCard({ college }: { college: College }) {
  const { state } = useApi(() => api.teams(college.id), [college.id]);
  return (
    <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
      <View style={styles.collegeHead}>
        <View style={styles.collegeTile}>
          <Text style={{ fontFamily: font.display, fontSize: 18, color: c.navy }}>
            {monogram(college.name)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.name, { fontSize: 16 }]}>{college.name}</Text>
          <Async state={state}>
            {(teams) => (
              <Text style={type.meta}>
                {teams.length
                  ? `${teams.length} team${teams.length === 1 ? '' : 's'}`
                  : 'No team on Team IMPACT yet'}
              </Text>
            )}
          </Async>
        </View>
      </View>
      <Async state={state}>
        {(teams: TeamSummary[]) =>
          teams.length ? (
            teams.map((t) => (
              <Pressable
                key={t.id}
                accessibilityRole="button"
                accessibilityLabel={`Ask to join ${t.name}`}
                onPress={() =>
                  router.push({
                    pathname: '/onboarding/request',
                    params: {
                      teamId: t.id,
                      teamName: `${t.college.name.split(' ')[0]} ${t.name}`,
                      division: t.division,
                    },
                  })
                }
                style={({ pressed }) => [styles.teamRow, pressed && { backgroundColor: c.ground }]}
              >
                <View style={[styles.teamTile, { backgroundColor: t.color ?? c.navy }]}>
                  <Text style={{ fontFamily: font.display, fontSize: 18, color: '#fff' }}>
                    {monogram(t.name)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[type.name, { fontSize: 16 }]}>{t.name}</Text>
                  <Text style={type.meta}>
                    {t.sport} · Division {t.division}
                  </Text>
                </View>
                <View style={styles.ask}>
                  <Text style={{ color: '#fff', fontFamily: font.bold, fontSize: 14 }}>
                    Ask to join
                  </Text>
                </View>
              </Pressable>
            ))
          ) : (
            <View style={{ padding: 16, paddingTop: 0 }}>
              <Button
                label="Ask us to add your team"
                kind="outline"
                icon="mail"
                onPress={() => askForTeam(college)}
              />
            </View>
          )
        }
      </Async>
    </Card>
  );
}

/** "/onboarding/find-team": search your college, then pick your team. Only live teams are listed. */
export default function FindTeam() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const colleges = useApi(() => api.colleges());
  return (
    <View style={{ flex: 1, backgroundColor: c.ground }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[styles.hero, { paddingTop: insets.top + 20 }]}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text style={styles.step}>STEP 1 OF 3</Text>
            <Button
              label="Scan QR instead"
              kind="onNavy"
              icon="qr"
              size="sm"
              onPress={() => router.push('/scan')}
            />
          </View>
          <Progress step={1} total={3} onNavy />
          <Text style={styles.heroTitle} accessibilityRole="header">
            FIND YOUR{'\n'}TEAM
          </Text>
          <View style={styles.search}>
            <Icon name="search" size={18} color={c.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Your college"
              placeholderTextColor={c.muted}
              accessibilityLabel="Your college"
              style={{ flex: 1, fontFamily: font.body, fontSize: 16, color: c.ink, minHeight: 48 }}
            />
          </View>
        </View>
        <View style={{ padding: 16, gap: 12 }}>
          <Async state={colleges.state}>
            {(list) =>
              list
                .filter((x) => x.name.toLowerCase().includes(query.trim().toLowerCase()))
                .map((x) => <CollegeCard key={x.id} college={x} />)
            }
          </Async>
          <Text style={[type.small, { paddingHorizontal: 8 }]}>
            Nothing about a team shows until a coach says yes. Have the coach’s QR code? Scanning it
            gets you in straight away.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: c.navy, paddingHorizontal: 20, paddingBottom: 28, gap: 16 },
  step: { fontFamily: font.bold, fontSize: 12, letterSpacing: 1.9, color: c.onNavy },
  heroTitle: { fontFamily: font.display, fontSize: 48, lineHeight: 45, color: '#fff' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: 26,
    backgroundColor: '#fff',
  },
  collegeHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  collegeTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: c.navyTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: c.lineSoft,
  },
  teamTile: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ask: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: c.red,
    justifyContent: 'center',
  },
});
