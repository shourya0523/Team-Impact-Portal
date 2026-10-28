import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { HexColor, type Team } from '@team-impact/contracts';
import {
  colors,
  isReadableTeamColor,
  layout,
  onTeamColor,
  radius,
  resolveTeamColor,
  spacing,
} from '@team-impact/ui-tokens';
import { api } from '@/api';
import { NoTeam, useTeamId } from '@/components/team';
import { Async, ErrorText, Gutter, Screen } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { Button, Card, Input, Text } from '@/ui';

const SWATCH = layout.avatar.lg;

function EditForm({ team }: { team: Team }) {
  const [name, setName] = useState(team.name);
  const [about, setAbout] = useState(team.about ?? '');
  const [color, setColor] = useState(team.color ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typed = color.trim();
  const colorError = !typed
    ? undefined
    : !HexColor.safeParse(typed).success
      ? `Use a 6-digit hex colour like ${colors.brand}`
      : !isReadableTeamColor(typed)
        ? 'Text can’t be read on this colour. Pick a darker or lighter one.'
        : undefined;
  const nameError = name.trim() ? undefined : 'The team needs a name.';
  const swatch = resolveTeamColor(colorError ? null : typed || null);

  const save = () => {
    if (colorError || nameError) return;
    setBusy(true);
    api
      .updateTeam(team.id, {
        name: name.trim(),
        about: about.trim() || null,
        color: typed ? typed.toUpperCase() : null,
      })
      .then(
        () => router.back(),
        (e: Error) => {
          setBusy(false);
          setError(e.message);
        },
      );
  };

  return (
    <>
      <Card>
        <Text variant="small" color="secondary">
          {team.college.name} · {team.sport} · Division {team.division}. Ask Team Impact to change
          these.
        </Text>
        <Input
          label="Team name"
          value={name}
          onChangeText={setName}
          maxLength={80}
          error={nameError}
        />
        <Input
          label="About the team"
          value={about}
          onChangeText={setAbout}
          maxLength={1000}
          multiline
          placeholder="What families and athletes should know"
        />
      </Card>
      <Card>
        <Text weight="semibold">Team colour</Text>
        <Text variant="small" color="secondary">
          Used on your team’s avatar and Baseball Card stripes. Leave it empty for Team IMPACT navy.
        </Text>
        <View style={styles.colorRow}>
          <View
            style={[styles.swatch, { backgroundColor: swatch }]}
            accessibilityRole="image"
            accessibilityLabel="Team colour preview"
          >
            <Text variant="display" size="xs" style={{ color: onTeamColor(swatch) }}>
              {name.trim().slice(0, 2) || 'TI'}
            </Text>
          </View>
          <View style={styles.grow}>
            <Input
              label="Hex colour"
              placeholder={colors.brand}
              value={color}
              onChangeText={setColor}
              autoCapitalize="characters"
              maxLength={7}
              error={colorError}
            />
          </View>
        </View>
        {typed !== '' && (
          <Button
            label="Use Team IMPACT navy"
            variant="secondary"
            size="sm"
            onPress={() => setColor('')}
          />
        )}
      </Card>
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Save" disabled={busy || !!colorError || !!nameError} onPress={save} />
    </>
  );
}

/** "/team/edit": coaches (and staff) edit the team's name, colour and about. The logo uploads separately. */
export default function EditTeam() {
  const teamId = useTeamId();
  const roster = useApi(() => (teamId ? api.roster(teamId) : Promise.resolve(null)), [teamId]);
  return (
    <Screen eyebrow="Team" title="Edit team" back>
      <Gutter>
        <Async state={roster.state}>
          {(r) =>
            !r ? (
              <NoTeam />
            ) : !r.canManage ? (
              <ErrorText>Only your team’s coaches can edit the team.</ErrorText>
            ) : (
              <EditForm team={r.team} />
            )
          }
        </Async>
      </Gutter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  colorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  grow: { flex: 1 },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
});
