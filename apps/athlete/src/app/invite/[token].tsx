import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CoachInvitePreview } from '@team-impact/contracts';
import { spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { shortDate } from '@/components/format';
import { CheckRow, errorMessage } from '@/components/signup';
import { Async, ErrorText, Gutter, Screen } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { Button, Card, Input, TeamAvatar, Text } from '@/ui';

/**
 * "/invite/[token]": a coach opens the link Team IMPACT (or a fellow coach) emailed them. A new
 * coach creates their account here, with the invite's email; someone who already has a coach
 * account signs in first. Either way they land on the team.
 */
export default function CoachInvite() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { state } = useApi(() => api.coachInvite(token), [token]);
  return (
    <Screen eyebrow="Coach invite" title="Join your team" back>
      <Async state={state}>{(invite) => <Accept token={token} invite={invite} />}</Async>
    </Screen>
  );
}

function Accept({ token, invite }: { token: string; invite: CoachInvitePreview }) {
  const { me, setMe, setRole } = useRole();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signedInAsInvitee = me?.email === invite.email;
  const newAccount = !me && !invite.hasAccount;

  const accept = () => {
    setBusy(true);
    setError(null);
    api
      .acceptCoachInvite(
        token,
        newAccount
          ? { newAccount: { firstName, lastName, password, acceptTerms: acceptTerms as true } }
          : {},
      )
      .then(
        (coach) => {
          setMe(coach);
          setRole(coach.role);
          router.replace('/team');
        },
        (e: unknown) => {
          setError(errorMessage(e));
          setBusy(false);
        },
      );
  };

  return (
    <Gutter gap="md">
      <Card style={styles.team}>
        <TeamAvatar name={invite.team.name} teamColor={invite.team.color} size="lg" />
        <View style={styles.grow}>
          <Text variant="display" size="xs" color="brand">
            {invite.team.college.name.split(' ')[0]} {invite.team.name}
          </Text>
          <Text variant="small" color="secondary">
            Invited by {invite.invitedBy.firstName} {invite.invitedBy.lastName}
          </Text>
          <Text variant="caption" weight="medium" color="muted">
            For {invite.email} · expires {shortDate(invite.expiresAt)}
          </Text>
        </View>
      </Card>

      {me && !signedInAsInvitee && (
        <ErrorText>
          This invite is for {invite.email}. Sign out, then open the link again.
        </ErrorText>
      )}

      {!me && invite.hasAccount && (
        <>
          <Text color="secondary">
            {invite.email} already has an account. Sign in, then open this link again to join the
            team.
          </Text>
          {__DEV__ && (
            <Button
              label="Mock sign-in"
              variant="secondary"
              onPress={() => router.push('/dev-sign-in')}
            />
          )}
        </>
      )}

      {newAccount && (
        <>
          <Text color="secondary">
            Create your coach account. Your email comes from the invite.
          </Text>
          <Input label="Email" value={invite.email} editable={false} />
          <Input
            label="First name"
            value={firstName}
            onChangeText={setFirstName}
            autoComplete="given-name"
          />
          <Input
            label="Last name"
            value={lastName}
            onChangeText={setLastName}
            autoComplete="family-name"
          />
          <Input
            label="Password (12 characters or more)"
            value={password}
            onChangeText={setPassword}
            autoComplete="new-password"
            secureTextEntry
          />
          <CheckRow
            label="I agree to the Terms and Privacy Policy"
            checked={acceptTerms}
            onToggle={() => setAcceptTerms((v) => !v)}
          />
        </>
      )}

      {(newAccount || signedInAsInvitee) && (
        <Button
          label={busy ? 'Joining…' : 'Accept and join the team'}
          size="lg"
          disabled={
            busy ||
            (newAccount &&
              (!firstName.trim() || !lastName.trim() || password.length < 12 || !acceptTerms))
          }
          onPress={accept}
        />
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </Gutter>
  );
}

const styles = StyleSheet.create({
  team: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1, gap: spacing.xs },
});
