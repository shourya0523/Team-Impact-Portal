import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@team-impact/ui-tokens';
import { api, ApiRequestError } from '@/api';
import { ROLE_LABEL } from '@/components/format';
import { openProfile } from '@/components/team';
import { ErrorText, Gutter, Screen } from '@/components/ui';
import { useRole } from '@/navigation/role';
import { Avatar, Badge, Button, Card, Input, Text } from '@/ui';

/**
 * "/me/edit": the owner edits their plain profile (PRD §2): name now, the photo with uploads. Role,
 * team and company come from how they joined, so they're shown here but not editable.
 */
export default function EditProfileScreen() {
  const { me, setMe } = useRole();
  const [firstName, setFirstName] = useState(me?.firstName ?? '');
  const [lastName, setLastName] = useState(me?.lastName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!me) return null;

  const changed = firstName.trim() !== me.firstName || lastName.trim() !== me.lastName;
  const save = () => {
    setBusy(true);
    setError(null);
    api
      .updateMe({ firstName: firstName.trim(), lastName: lastName.trim() })
      .then(
        (updated) => {
          setMe(updated);
          setSaved(true);
        },
        (e: Error) =>
          setError(
            // Show the field's own message (e.g. "Too small") instead of a generic failure.
            e instanceof ApiRequestError && e.body.error.issues?.[0]
              ? e.body.error.issues[0].message
              : e.message,
          ),
      )
      .finally(() => setBusy(false));
  };

  return (
    <Screen eyebrow="Your profile" title="Edit profile" back>
      <Gutter>
        <Card>
          <View style={styles.row}>
            <Avatar name={`${me.firstName} ${me.lastName}`} role={me.role} size="lg" />
            <Badge caps variant="brandTint" label={ROLE_LABEL[me.role]} />
          </View>
          <Input
            label="First name"
            value={firstName}
            onChangeText={(v) => {
              setFirstName(v);
              setSaved(false);
            }}
            autoComplete="given-name"
          />
          <Input
            label="Last name"
            value={lastName}
            onChangeText={(v) => {
              setLastName(v);
              setSaved(false);
            }}
            autoComplete="family-name"
          />
          {error && <ErrorText>{error}</ErrorText>}
          {saved && (
            <Text variant="small" color="secondary">
              Saved. Your team sees the new name now.
            </Text>
          )}
          <Button
            label={busy ? 'Saving…' : 'Save'}
            onPress={save}
            disabled={busy || !changed || !firstName.trim() || !lastName.trim()}
          />
        </Card>
        <Button
          label="See my profile as others do"
          variant="secondary"
          onPress={() => openProfile(me.id)}
        />
      </Gutter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
