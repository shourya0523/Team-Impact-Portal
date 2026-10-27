import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ChildProfile } from '@team-impact/contracts';
import { colors, spacing } from '@team-impact/ui-tokens';
import { api, ApiRequestError, uploadPhoto, UploadProblem } from '@/api';
import { CheckRow } from '@/components/signup';
import { Async, ErrorText, Gutter, Screen, SectionLabel } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { Avatar, Button, Card, Icon, Input, TeamAvatar, Text } from '@/ui';

/**
 * Adds or changes the child's photo (PRD F3) through the one upload path. The parent first
 * confirms they have the right to share it, which the API requires for every photo.
 */
function ChildPhoto({
  child,
  onChange,
}: {
  child: ChildProfile;
  onChange: (c: ChildProfile) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async () => {
    setError(null);
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      // A square crop re-encodes the photo, and 'compatible' asks iOS for JPEG rather than HEIC,
      // which browsers can't show and the API doesn't accept.
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) return;
    setBusy(true);
    try {
      await uploadPhoto(asset.uri, { purpose: 'child_photo', childId: child.id }, asset.mimeType);
      const updated = (await api.children()).find((c) => c.id === child.id);
      if (updated) onChange(updated);
      setOpen(false);
      setRights(false);
    } catch (e) {
      setError(
        e instanceof UploadProblem
          ? e.message
          : e instanceof ApiRequestError && e.body.error.issues?.[0]
            ? e.body.error.issues[0].message
            : 'The photo didn’t upload. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button
        label={child.photoUrl ? 'Change photo' : 'Add photo'}
        variant="secondary"
        size="sm"
        onPress={() => setOpen(true)}
      />
    );
  }
  return (
    <View style={styles.block}>
      <CheckRow
        label={`I have the right to share this photo of ${child.firstName}`}
        checked={rights}
        onToggle={() => setRights((r) => !r)}
      />
      <Text variant="caption" color="muted">
        Only your team and family see it. Never in search, recruiter views or card exports.
      </Text>
      {error && <ErrorText>{error}</ErrorText>}
      <View style={styles.row}>
        <Button
          label="Cancel"
          variant="secondary"
          size="sm"
          stretch
          onPress={() => {
            setOpen(false);
            setRights(false);
            setError(null);
          }}
        />
        <Button
          label={busy ? 'Uploading…' : 'Choose photo'}
          size="sm"
          stretch
          disabled={!rights || busy}
          onPress={() => void choose()}
        />
      </View>
    </View>
  );
}

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
        <ChildPhoto child={current} onChange={setCurrent} />
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
