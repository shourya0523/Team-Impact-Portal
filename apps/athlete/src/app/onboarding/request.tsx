import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CreateJoinRequest, NewChild, ParentRelationship } from '@team-impact/contracts';
import { api } from '@/api';
import { AddChildren } from '@/components/AddChildren';
import { ROLE_LABEL } from '@/components/format';
import { colors, radius, spacing } from '@team-impact/ui-tokens';
import { ErrorText, IconButton, Progress } from '@/components/ui';
import { useRole } from '@/navigation/role';
import { monogram } from '@/theme';
import { Avatar, Button, Card, Icon, Text } from '@/ui';

const BADGE = 52;

const YEARS = [2027, 2028, 2029, 2030];

function Choice({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      style={[styles.choice, on ? styles.choiceOn : null]}
    >
      {on && <Icon name="check" size={20} color={colors.brand} strokeWidth={3} />}
      <Text variant="display" size="xs" color={on ? 'brand' : 'ink'} accessibilityRole="none">
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * "/onboarding/request": the slow lane. Athletes give their class year, parents say parent or
 * guardian, teens just ask. Nothing about the team shows until a coach approves.
 */
export default function Request() {
  const { teamId, teamName, division } = useLocalSearchParams<{
    teamId: string;
    teamName: string;
    division?: string;
  }>();
  const { role, me } = useRole();
  const insets = useSafeAreaInsets();
  const [classYear, setClassYear] = useState<number | null>(null);
  const [relationship, setRelationship] = useState<ParentRelationship | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const [children, setChildren] = useState<NewChild[]>([]);

  const body: CreateJoinRequest | null =
    role === 'athlete' && classYear
      ? { role, teamId, classYear }
      : role === 'parent' && relationship
        ? { role, teamId, relationship, ...(children.length ? { children } : {}) }
        : role === 'teen'
          ? { role, teamId }
          : null;

  const send = () => {
    if (!body) return;
    setSending(true);
    api.requestToJoin(body).then(
      () => router.replace({ pathname: '/onboarding/pending', params: { teamName, teamId } }),
      (e: Error) => {
        setError(e.message);
        setSending(false);
      },
    );
  };

  const detail =
    role === 'athlete' && classYear
      ? `Athlete · Class of ${classYear}`
      : role === 'parent' && relationship
        ? `${relationship === 'parent' ? 'Parent' : 'Guardian'}`
        : role
          ? ROLE_LABEL[role]
          : '';

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.topBar}>
          <IconButton icon="back" label="Back" onPress={() => router.back()} />
          <Progress step={2} total={3} />
        </View>

        <View style={styles.teamCard}>
          <Text variant="decor" size="md" style={styles.teamMonogram}>
            {monogram(teamName ?? '', true)}
          </Text>
          <View style={styles.teamBadge}>
            <Text variant="display" size="xs" color="brand" accessibilityRole="none">
              {monogram(teamName ?? '', true)}
            </Text>
          </View>
          <View>
            <Text variant="eyebrow" color="onBrandSecondary">
              Asking to join
            </Text>
            <Text weight="semibold" color="onBrand">
              {teamName}
            </Text>
            {division && (
              <Text variant="caption" color="onBrandSecondary">
                Division {division}
              </Text>
            )}
          </View>
        </View>

        {role === 'athlete' && (
          <View style={styles.section}>
            <Text variant="display" size="lg" color="brand">
              What’s your class?
            </Text>
            <View accessibilityRole="radiogroup" style={styles.grid}>
              {YEARS.map((y) => (
                <Choice
                  key={y}
                  label={String(y)}
                  on={classYear === y}
                  onPress={() => setClassYear(y)}
                />
              ))}
            </View>
          </View>
        )}
        {role === 'parent' && (
          <View style={styles.section}>
            <Text variant="display" size="lg" color="brand">
              You are their…
            </Text>
            <View accessibilityRole="radiogroup" style={styles.grid}>
              <Choice
                label="PARENT"
                on={relationship === 'parent'}
                onPress={() => setRelationship('parent')}
              />
              <Choice
                label="GUARDIAN"
                on={relationship === 'guardian'}
                onPress={() => setRelationship('guardian')}
              />
            </View>
            <AddChildren value={children} onChange={setChildren} />
          </View>
        )}
        {role === 'teen' && (
          <Text variant="display" size="lg" color="brand">
            Ready to ask?
          </Text>
        )}

        {me && (
          <Card>
            <Text variant="eyebrow" color="secondary">
              The coach will see
            </Text>
            <View style={styles.person}>
              <Avatar name={`${me.firstName} ${me.lastName}`} role={me.role} />
              <View>
                <Text weight="semibold">
                  {me.firstName} {me.lastName}
                </Text>
                <Text variant="small" color="secondary">
                  {detail}
                </Text>
              </View>
            </View>
            {role === 'parent' && children.length > 0 && (
              <Text variant="small" color="secondary">
                {`Your ${children.length === 1 ? 'child' : 'children'}: ${children
                  .map((c) => `${c.firstName} ${c.lastInitial.toUpperCase()}.`)
                  .join(', ')}, with age only. Never a birth date.`}
              </Text>
            )}
            <Text variant="small" color="secondary">
              That’s all. Your resume isn’t needed to join.
            </Text>
          </Card>
        )}

        {error && <ErrorText>{error}</ErrorText>}
        <View style={styles.grow} />
        <Button
          label={sending ? 'Sending…' : 'Send request'}
          size="lg"
          icon="mail"
          jersey
          onPress={send}
          disabled={!body || sending}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: spacing.md, gap: spacing.lg, flexGrow: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  section: { gap: spacing.md },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  teamCard: {
    backgroundColor: colors.brand,
    borderRadius: radius.card,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    overflow: 'hidden',
  },
  teamMonogram: {
    position: 'absolute',
    right: -8,
    bottom: -34,
    color: colors.brandRaised,
  },
  teamBadge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: {
    width: '48%',
    flexGrow: 1,
    minHeight: spacing['3xl'],
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  choiceOn: { borderWidth: 2, borderColor: colors.brand, backgroundColor: colors.brandTint },
});
