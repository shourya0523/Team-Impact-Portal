import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CreateJoinRequest, ParentRelationship } from '@team-impact/contracts';
import { api } from '@/api';
import { ROLE_LABEL } from '@/components/format';
import { Icon } from '@/components/Icon';
import { Avatar, Button, Card, IconButton, Progress, type } from '@/components/ui';
import { useRole } from '@/navigation/role';
import { c, font, monogram } from '@/theme';

const YEARS = [2027, 2028, 2029, 2030];

function Choice({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      style={[styles.choice, on ? styles.choiceOn : null]}
    >
      {on && <Icon name="check" size={20} color={c.navy} strokeWidth={3} />}
      <Text style={{ fontFamily: font.display, fontSize: 28, color: on ? c.navy : c.ink }}>
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

  const body: CreateJoinRequest | null =
    role === 'athlete' && classYear
      ? { role, teamId, classYear }
      : role === 'parent' && relationship
        ? { role, teamId, relationship }
        : role === 'teen'
          ? { role, teamId }
          : null;

  const send = () => {
    if (!body) return;
    setSending(true);
    api.requestToJoin(body).then(
      () => router.replace({ pathname: '/onboarding/pending', params: { teamName } }),
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
    <View style={{ flex: 1, backgroundColor: c.ground }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, gap: 20, flexGrow: 1 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconButton icon="back" label="Back" onPress={() => router.back()} />
          <Progress step={2} total={3} />
        </View>

        <View style={styles.teamCard}>
          <Text style={styles.teamMonogram} aria-hidden>
            {monogram(teamName ?? '', true)}
          </Text>
          <View style={styles.teamBadge}>
            <Text style={{ fontFamily: font.display, fontSize: 22, color: c.navy }}>
              {monogram(teamName ?? '', true)}
            </Text>
          </View>
          <View>
            <Text
              style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 1.4, color: c.onNavy }}
            >
              ASKING TO JOIN
            </Text>
            <Text style={{ fontFamily: font.bold, fontSize: 18, color: '#fff' }}>{teamName}</Text>
            {division && (
              <Text style={{ fontFamily: font.body, fontSize: 13, color: c.onNavy }}>
                Division {division}
              </Text>
            )}
          </View>
        </View>

        {role === 'athlete' && (
          <View style={{ gap: 12 }}>
            <Text
              style={[type.display, { fontSize: 40, lineHeight: 39 }]}
              accessibilityRole="header"
            >
              WHAT’S YOUR CLASS?
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
          <View style={{ gap: 12 }}>
            <Text
              style={[type.display, { fontSize: 40, lineHeight: 39 }]}
              accessibilityRole="header"
            >
              YOU ARE THEIR…
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
          </View>
        )}
        {role === 'teen' && (
          <Text style={[type.display, { fontSize: 40, lineHeight: 39 }]} accessibilityRole="header">
            READY TO ASK?
          </Text>
        )}

        {me && (
          <Card>
            <Text
              style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 1.4, color: c.text2 }}
            >
              THE COACH WILL SEE
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar firstName={me.firstName} lastName={me.lastName} role={me.role} />
              <View>
                <Text style={type.name}>
                  {me.firstName} {me.lastName}
                </Text>
                <Text style={type.small}>{detail}</Text>
              </View>
            </View>
            <Text style={type.small}>That’s all. Your resume isn’t needed to join.</Text>
          </Card>
        )}

        {error && (
          <Text
            style={{ color: c.danger, fontFamily: font.medium, fontSize: 15 }}
            accessibilityRole="alert"
          >
            {error}
          </Text>
        )}
        <View style={{ flex: 1 }} />
        <Button
          label={sending ? 'Sending…' : 'Send request'}
          size="lg"
          onPress={send}
          disabled={!body || sending}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  teamCard: {
    backgroundColor: c.navy,
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    overflow: 'hidden',
  },
  teamMonogram: {
    position: 'absolute',
    right: -8,
    bottom: -34,
    fontFamily: font.display,
    fontSize: 110,
    lineHeight: 120,
    color: c.navyRaised,
  },
  teamBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choice: {
    width: '48%',
    flexGrow: 1,
    minHeight: 64,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  choiceOn: { borderWidth: 2, borderColor: c.navy, backgroundColor: c.navyTint },
});
