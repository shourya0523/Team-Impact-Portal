import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { College, TeamSummary } from '@team-impact/contracts';
import { api } from '@/api';
import { colors, layout, radius, spacing, typography } from '@team-impact/ui-tokens';
import { Async, Chip, Progress } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { monogram } from '@/theme';
import { useRole } from '@/navigation/role';
import { Button, Card, Icon, TeamAvatar, Text, typeStyle, type IconName } from '@/ui';

/**
 * For teams that aren't registered yet (PRD §3, P7). Without a college (nothing matched the
 * search), the email leaves both lines for people to fill in.
 */
const askForTeam = (college?: College) =>
  Linking.openURL(
    `mailto:appdev@teamimpact.org?subject=${encodeURIComponent(
      college ? `Add my team: ${college.name}` : 'Add my team',
    )}&body=${encodeURIComponent(`College: ${college?.name ?? ''}\nSport: `)}`,
  );

/** The sports a college's teams play, in a stable order. */
const sportsOf = (teams: TeamSummary[]) => [...new Set(teams.map((t) => t.sport))].sort();

/** The dashed "not here yet" box from the mockup, with a way to ask us to add the team. */
function Notice({
  icon,
  title,
  body,
  college,
}: {
  icon: IconName;
  title: string;
  body: string;
  college?: College;
}) {
  return (
    <View style={styles.notice}>
      <Icon name={icon} size={20} color={colors.text.secondary} />
      <View style={styles.noticeText}>
        <Text weight="semibold">{title}</Text>
        <Text variant="small" color="secondary">
          {body}
        </Text>
        <Button
          label="Ask us to add your team"
          variant="secondary"
          size="sm"
          icon="mail"
          onPress={() => askForTeam(college)}
        />
      </View>
    </View>
  );
}

/**
 * A college, then the sport step: when its teams play more than one sport, people pick the sport
 * first and only that sport's teams are listed (`GET /teams?collegeId&sport`).
 */
function CollegeCard({ college }: { college: College }) {
  const all = useApi(() => api.teams(college.id), [college.id]);
  const [sport, setSport] = useState<string | null>(null);
  const filtered = useApi(
    () => (sport ? api.teams(college.id, sport) : Promise.resolve<TeamSummary[]>([])),
    [college.id, sport],
  );
  const sports = all.state.status === 'ready' ? sportsOf(all.state.data) : [];
  const needsSport = sports.length > 1;
  const { state, reload } = needsSport ? filtered : all;
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
          <Async state={all.state} onRetry={all.reload}>
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
      {needsSport && (
        <View style={styles.sports}>
          <Text variant="small" weight="semibold" color="secondary">
            {sport ? 'Your sport' : 'Pick your sport'}
          </Text>
          <View accessibilityRole="radiogroup" style={styles.chips}>
            {sports.map((s) => (
              <Chip
                key={s}
                label={s}
                selected={sport === s}
                onPress={() => setSport(sport === s ? null : s)}
              />
            ))}
          </View>
        </View>
      )}
      {needsSport && !sport ? null : (
        <Async state={state} onRetry={reload}>
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
                        teamColor: t.color ?? '',
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
                <Notice
                  icon="flag"
                  title={`${sport ?? 'Your team'} at ${college.name} isn’t on Team IMPACT yet`}
                  body="Ask the coach to contact Team IMPACT. You can request to join once the team is set up."
                  college={college}
                />
              </View>
            )
          }
        </Async>
      )}
    </Card>
  );
}

/** "/onboarding/find-team": search your college, then pick your team. Only live teams are listed. */
export default function FindTeam() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const colleges = useApi(() => api.colleges());
  const isParent = useRole().role === 'parent';
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
            {isParent ? 'Find your child’s team' : 'Find your\nteam'}
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
          <Async state={colleges.state} onRetry={colleges.reload}>
            {(list) => {
              const q = query.trim();
              const matches = list.filter((x) => x.name.toLowerCase().includes(q.toLowerCase()));
              if (matches.length) return matches.map((x) => <CollegeCard key={x.id} college={x} />);
              return (
                <Notice
                  icon="search"
                  title={q ? `No college matches “${q}”` : 'No colleges on Team IMPACT yet'}
                  body={
                    q
                      ? 'Check the spelling, or try the college’s short name. If it isn’t here, its teams aren’t on Team IMPACT yet.'
                      : 'Once a college’s teams join, you’ll find them here.'
                  }
                />
              );
            }}
          </Async>
          <Text variant="small" color="secondary" style={styles.note}>
            Nothing about a team shows until a coach says yes. Have the coach’s QR code? Scanning it
            gets you in straight away.
          </Text>
          <Button
            label="Have a QR code from the coach? Scan it"
            variant="secondary"
            icon="qr"
            onPress={() => router.push('/scan')}
          />
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
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  noticeText: { flex: 1, gap: spacing.sm, alignItems: 'flex-start' },
  sports: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
