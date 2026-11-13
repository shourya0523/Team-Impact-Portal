import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Email } from '@team-impact/contracts';
import { colors, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { dateTime, shortDate } from '@/components/format';
import { fullName, NoTeam, useTeamId } from '@/components/team';
import { Async, ErrorText, Gutter, Screen, SectionLabel } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { Button, Card, Icon, Input, Text } from '@/ui';

/**
 * "/team/add-coach": a coach invites another coach by email. The invite is single-use, lasts 7
 * days and only works for that email; it's accepted from the emailed link.
 */
export default function AddCoach() {
  const teamId = useTeamId();
  const invites = useApi(
    () => (teamId ? api.coachInvites(teamId) : Promise.resolve(null)),
    [teamId],
  );
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = () => {
    if (!teamId) return;
    const parsed = Email.safeParse(email.trim());
    if (!parsed.success) {
      setFieldError('Enter an email address');
      return;
    }
    setFieldError(undefined);
    setBusy(true);
    api.inviteCoach(teamId, parsed.data).then(
      (invite) => {
        setBusy(false);
        setError(null);
        setEmail('');
        setSent(invite.email);
        invites.reload();
      },
      (e: Error) => {
        setBusy(false);
        setError(e.message);
      },
    );
  };

  const revoke = (id: string) =>
    api.revokeCoachInvite(id).then(invites.reload, (e: Error) => setError(e.message));

  return (
    <Screen eyebrow="Team" title="Add a coach" back>
      {!teamId ? (
        <Gutter>
          <NoTeam />
        </Gutter>
      ) : (
        <>
          <Gutter>
            <Card>
              <Text color="secondary">
                We’ll email them a link to join as a coach. It works once, for that email, for 7
                days. Coaches approve requests, remove members and make QR codes.
              </Text>
              <Input
                label="Their email"
                placeholder="coach@college.edu"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setSent(null);
                }}
                error={fieldError}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                onSubmitEditing={send}
              />
              {error && <ErrorText>{error}</ErrorText>}
              {sent && (
                <View style={styles.sent}>
                  <Icon name="check" size={18} color={colors.success.text} />
                  <Text variant="small" color="success">
                    Invite sent to {sent}
                  </Text>
                </View>
              )}
              <Button label="Send invite" icon="mail" disabled={busy} onPress={send} />
            </Card>
          </Gutter>
          <SectionLabel>Waiting to accept</SectionLabel>
          <Gutter gap="sm">
            <Async state={invites.state} onRetry={invites.reload}>
              {(list) =>
                list && list.length ? (
                  list.map((i) => (
                    <Card key={i.id}>
                      <View style={styles.row}>
                        <View style={styles.grow}>
                          <Text weight="semibold">{i.email}</Text>
                          <Text variant="caption" weight="medium" color="muted">
                            Sent {shortDate(i.createdAt)} by {fullName(i.invitedBy)} · expires{' '}
                            {dateTime(i.expiresAt)}
                          </Text>
                        </View>
                        <Button
                          label="Cancel"
                          variant="secondary"
                          size="sm"
                          accessibilityLabel={`Cancel the invite to ${i.email}`}
                          onPress={() => revoke(i.id)}
                        />
                      </View>
                    </Card>
                  ))
                ) : (
                  <Text variant="small" color="secondary">
                    No invites waiting.
                  </Text>
                )
              }
            </Async>
          </Gutter>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1, gap: spacing.xs },
  sent: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
