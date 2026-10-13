import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ChildProfile } from '@team-impact/contracts';
import { colors, spacing } from '@team-impact/ui-tokens';
import { api, ApiRequestError } from '@/api';
import { Async, ErrorText, Gutter, Screen, SectionLabel } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { Avatar, Button, Card, Icon, Input, TeamAvatar, Text } from '@/ui';

/** The parent edits what the team sees: first name, age and an optional interests bio (PRD F3). */
function ChildCard({ child }: { child: ChildProfile }) {
  const [current, setCurrent] = useState(child);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(child.firstName);
  const [age, setAge] = useState(String(child.age));
  const [bio, setBio] = useState(child.bio ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = () =>
    api
      .updateChild(child.id, {
        firstName: firstName.trim(),
        age: Number(age),
        bio: bio.trim() || null,
      })
      .then(
        (c) => {
          setCurrent(c);
          setEditing(false);
          setError(null);
        },
        (e: Error) =>
          setError(
            e instanceof ApiRequestError && e.body.error.issues?.[0]
              ? e.body.error.issues[0].message
              : e.message,
          ),
      );

  return (
    <View style={styles.block}>
      <Card>
        <View style={styles.row}>
          <Avatar name={current.firstName} uri={current.photoUrl ?? undefined} size="lg" />
          <View style={styles.grow}>
            <Text variant="display" size="sm" color="brand">
              {current.firstName}, {current.age}
            </Text>
            {current.team ? (
              <View style={styles.row}>
                <TeamAvatar name={current.team.name} teamColor={current.team.color} size="sm" />
                <Text variant="small" color="secondary">
                  {current.team.college.name} {current.team.name}
                </Text>
              </View>
            ) : (
              <Text variant="small" color="secondary">
                Not on a team right now
              </Text>
            )}
          </View>
        </View>
        {editing ? (
          <>
            <Input label="First name" value={firstName} onChangeText={setFirstName} />
            <Input label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" />
            <Input
              label="Interests (optional)"
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={300}
              placeholder="Favourite position, teams, hobbies"
            />
            <Text variant="caption" color="muted">
              No health details here, please. Just what your child would like the team to know.
            </Text>
            {error && <ErrorText>{error}</ErrorText>}
            <View style={styles.row}>
              <Button
                label="Cancel"
                variant="secondary"
                size="sm"
                stretch
                onPress={() => setEditing(false)}
              />
              <Button label="Save" size="sm" stretch onPress={save} />
            </View>
          </>
        ) : (
          <>
            {current.bio ? (
              <Text>{current.bio}</Text>
            ) : (
              <Text variant="small" color="secondary">
                Add a few interests so the team gets to know {current.firstName}.
              </Text>
            )}
            <View style={styles.row}>
              <Button
                label="Edit"
                variant="secondary"
                size="sm"
                stretch
                onPress={() => setEditing(true)}
              />
              <Button
                label="See as the team does"
                variant="brand"
                size="sm"
                stretch
                onPress={() =>
                  router.push({ pathname: '/me/profile/[id]', params: { id: current.id } })
                }
              />
            </View>
          </>
        )}
      </Card>
    </View>
  );
}

/** "/child": the parent runs their child's profile. Children never sign in. */
export default function ChildProfileScreen() {
  const { state } = useApi(() => api.children());
  return (
    <Screen eyebrow="Your family" title="Child profile">
      <Gutter>
        <Card style={[styles.row, styles.tint]}>
          <Icon name="lock" size={18} color={colors.brand} />
          <Text variant="small" color="brand" style={styles.grow}>
            Visible only to your team and family. Never in search, recruiter views or card exports.
          </Text>
        </Card>
      </Gutter>
      <SectionLabel>Your children</SectionLabel>
      <Async state={state}>
        {(children) => (
          <Gutter>
            {children.length === 0 ? (
              <Text color="secondary">
                Your child’s profile appears here once the coach approves your join request.
              </Text>
            ) : (
              children.map((c) => <ChildCard key={c.id} child={c} />)
            )}
          </Gutter>
        )}
      </Async>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tint: { backgroundColor: colors.brandTint, borderColor: colors.brandTint },
  grow: { flex: 1, gap: spacing.xs },
});
