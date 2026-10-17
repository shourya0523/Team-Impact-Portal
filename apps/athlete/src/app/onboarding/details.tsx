import { Redirect, router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import type { AlumniProfile } from '@team-impact/contracts';
import { colors, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { errorMessage } from '@/components/signup';
import { SwitchRow } from '@/components/SwitchRow';
import { Async, ErrorText, Gutter, Screen, SectionLabel } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { firstTab } from '@/navigation/tabs';
import { Button, Card, Icon, Input, Text } from '@/ui';

function DetailsForm({ initial, next }: { initial: AlumniProfile; next: Href }) {
  const { role } = useRole();
  const [college, setCollege] = useState(initial.college);
  const [employer, setEmployer] = useState(initial.employer ?? '');
  const [mentoring, setMentoring] = useState(initial.mentoring);
  const [hiring, setHiring] = useState(initial.hiring);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = (then: Href) => {
    setBusy(true);
    setError(null);
    api
      .updateMyAlumni({
        college: college.trim(),
        employer: employer.trim() || null,
        mentoring,
        hiring,
      })
      .then(
        () => router.replace(then),
        (e: unknown) => {
          setError(errorMessage(e));
          setBusy(false);
        },
      );
  };
  const ready = college.trim().length > 0 && !busy;
  const sharing = mentoring || hiring;

  return (
    <Gutter gap="md">
      <Text color="secondary">
        Tell athletes where you studied and where you are now. College can be anywhere, not just
        Team IMPACT schools.
      </Text>
      <Input
        label="College attended"
        value={college}
        onChangeText={setCollege}
        placeholder="Tufts University"
        maxLength={120}
      />
      <Input
        label="Where you work now (optional)"
        value={employer}
        onChangeText={setEmployer}
        placeholder="Company or organisation"
        maxLength={120}
      />

      <SectionLabel>Open to helping athletes?</SectionLabel>
      <Card>
        <SwitchRow
          label="Mentoring"
          detail="Athletes can find you and reach out for advice."
          value={mentoring}
          onChange={setMentoring}
        />
        <SwitchRow
          label="Hiring"
          detail="Your profile shows you’re hiring."
          value={hiring}
          onChange={setHiring}
        />
      </Card>
      <Card style={styles.note}>
        <Icon name={sharing ? 'users' : 'lock'} size={18} color={colors.brand} />
        <Text variant="small" color="brand" style={styles.grow}>
          {sharing
            ? 'Athletes will see your profile and your contact details, starting with the email you signed up with. There’s no messaging, so that’s how they reach you.'
            : 'Both off: athletes don’t see your profile or contact details. Turning either on shows them to athletes.'}
        </Text>
      </Card>

      {error && <ErrorText>{error}</ErrorText>}
      <Button
        label={busy ? 'Saving…' : 'Finish'}
        size="lg"
        disabled={!ready}
        onPress={() => save(next)}
      />
      {role === 'alumni_athlete' && (
        <Button
          label="Finish and claim a pre-built card"
          variant="secondary"
          disabled={!ready}
          onPress={() => save('/card/claim')}
        />
      )}
      <Button
        label="Skip for now"
        variant="secondary"
        disabled={busy}
        onPress={() => router.replace(next)}
      />
    </Gutter>
  );
}

/**
 * "/onboarding/details": the alumni details step after creating an account (L3, L4). College
 * attended (free text), where they work, and the mentoring and hiring switches, both off until the
 * alumnus turns them on. Only alumni come here; anyone else goes to their first tab.
 */
export default function Details() {
  const { role, ready } = useRole();
  const alumni = role === 'alumni_athlete' || role === 'alumni_mentor';
  const { state } = useApi(
    () => (alumni ? api.myAlumni() : Promise.reject(new Error('Alumni only'))),
    [alumni],
  );
  if (!ready) return null;
  if (!role) return <Redirect href="/welcome" />;
  if (!alumni) return <Redirect href={firstTab(role)} />;
  return (
    <Screen eyebrow="Welcome back · last step" title="Where are you now?">
      <Async state={state}>
        {(initial) => <DetailsForm initial={initial} next={firstTab(role)} />}
      </Async>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.brandTint,
    borderColor: colors.brandTint,
  },
  grow: { flex: 1 },
});
