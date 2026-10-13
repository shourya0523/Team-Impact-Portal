import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { College, TeamSummary } from '@team-impact/contracts';
import { api } from '@/api';
import { colors, layout, radius, spacing, typography } from '@team-impact/ui-tokens';
import { Async, Progress } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { monogram } from '@/theme';
import { Button, Card, Icon, TeamAvatar, Text, typeStyle } from '@/ui';

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
    <Card style={styles.college}>
      <View style={styles.collegeHead}>
        <View style={styles.collegeTile}>
          <Text variant="display" size="xs" color="brand" accessibilityRole="none">
            {monogram(college.name)}
          </Text>
        </View>
        <View style={styles.grow}>
          <Text weight="semibold">{college.name}</Text>
          <Async state={state}>
            {(teams) => (
              <Text variant="caption" weight="medium" color="muted">
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
                style={({ pressed }) => [
                  styles.teamRow,
                  pressed && { backgroundColor: colors.ground },
                ]}
              >
                <TeamAvatar name={t.name} teamColor={t.color} />
                <View style={styles.grow}>
                  <Text weight="semibold">{t.name}</Text>
                  <Text variant="caption" weight="medium" color="muted">
                    {t.sport} · Division {t.division}
                  </Text>
                </View>
                {/* Looks like a button; the whole row is the button (no nesting on web). */}
                <View style={styles.ask}>
                  <Text variant="small" weight="semibold" color="onBrand">
                    Ask to join
                  </Text>
                </View>
              </Pressable>
            ))
          ) : (
            <View style={styles.empty}>
              <Button
                label="Ask us to add your team"
                variant="secondary"
                size="sm"
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
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.heroTop}>
            <Text variant="eyebrow" color="onBrandSecondary">
              Step 1 of 3
            </Text>
            <Button
              label="Scan QR instead"
              variant="ghostOnBrand"
              icon="qr"
              size="sm"
              onPress={() => router.push('/scan')}
            />
          </View>
          <Progress step={1} total={3} onNavy />
          <Text variant="display" size="xl" color="onBrand">
            Find your{'\n'}team
          </Text>
          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.text.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Your college"
              placeholderTextColor={colors.text.muted}
              accessibilityLabel="Your college"
              style={styles.searchInput}
            />
          </View>
        </View>
        <View style={styles.list}>
          <Async state={colleges.state}>
            {(list) =>
              list
                .filter((x) => x.name.toLowerCase().includes(query.trim().toLowerCase()))
                .map((x) => <CollegeCard key={x.id} college={x} />)
            }
          </Async>
          <Text variant="small" color="secondary" style={styles.note}>
            Nothing about a team shows until a coach says yes. Have the coach’s QR code? Scanning it
            gets you in straight away.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  scroll: { paddingBottom: spacing.xl },
  hero: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  searchInput: {
    ...typeStyle(typography.body),
    flex: 1,
    color: colors.ink,
    minHeight: layout.buttonHeight.md,
  },
  list: { padding: spacing.md, gap: spacing.md },
  note: { paddingHorizontal: spacing.sm },
  grow: { flex: 1 },
  college: { padding: spacing.none, gap: spacing.none, overflow: 'hidden' },
  collegeHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  collegeTile: {
    width: layout.avatar.md,
    height: layout.avatar.md,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  ask: {
    minHeight: layout.buttonHeight.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.action,
    justifyContent: 'center',
  },
  empty: { padding: spacing.md, paddingTop: spacing.none },
});
