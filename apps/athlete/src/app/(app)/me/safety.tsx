import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { MyReport } from '@team-impact/contracts';
import { spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { ROLE_LABEL, shortDate } from '@/components/format';
import { REASON_LABEL } from '@/components/Report';
import { Async, ErrorText, Gutter, Screen, SectionLabel } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { Avatar, Badge, Button, Card, Text } from '@/ui';

const TARGET_LABEL: Record<MyReport['target']['kind'], string> = {
  post: 'A post',
  comment: 'A comment',
  event: 'An event',
  profile: 'A profile',
  community: 'A community',
};

/** Who you've blocked (P2). Unblocking brings their posts back for both of you. */
function Blocked() {
  const { state, reload } = useApi(() => api.blocks());
  const [error, setError] = useState<string | null>(null);
  const unblock = (userId: string) =>
    api.unblock(userId).then(reload, (e: Error) => setError(e.message));
  return (
    <Async state={state}>
      {(blocks) => (
        <Card>
          {blocks.length === 0 ? (
            <Text variant="small" color="secondary">
              You haven’t blocked anyone. Block someone from the flag on their post.
            </Text>
          ) : (
            blocks.map((b) => (
              <View key={b.user.id} style={styles.row}>
                <Avatar name={`${b.user.firstName} ${b.user.lastName}`} role={b.user.role} />
                <View style={styles.grow}>
                  <Text weight="semibold">
                    {b.user.firstName} {b.user.lastName}
                  </Text>
                  <Text variant="caption" weight="medium" color="muted">
                    {ROLE_LABEL[b.user.role]} · blocked {shortDate(b.blockedAt)}
                  </Text>
                </View>
                <Button
                  label="Unblock"
                  variant="secondary"
                  size="sm"
                  onPress={() => unblock(b.user.id)}
                />
              </View>
            ))
          )}
          {error && <ErrorText>{error}</ErrorText>}
        </Card>
      )}
    </Async>
  );
}

/** What you've reported and whether staff have looked at it yet (never their decision). */
function Reports() {
  const { state } = useApi(() => api.myReports());
  return (
    <Async state={state}>
      {(reports) => (
        <Card>
          {reports.length === 0 ? (
            <Text variant="small" color="secondary">
              No reports. Use the flag on a post, community or profile if something isn’t right.
            </Text>
          ) : (
            reports.map((r) => (
              <View key={r.id} style={styles.row}>
                <View style={styles.grow}>
                  <Text weight="semibold">
                    {TARGET_LABEL[r.target.kind]} · {REASON_LABEL[r.reason]}
                  </Text>
                  <Text variant="caption" weight="medium" color="muted">
                    Sent {shortDate(r.createdAt)}
                  </Text>
                </View>
                <Badge
                  label={r.status === 'open' ? 'Under review' : 'Reviewed'}
                  variant={r.status === 'open' ? 'warning' : 'success'}
                  caps
                />
              </View>
            ))
          )}
        </Card>
      )}
    </Async>
  );
}

/** P3: hidden at once, erased after 30 days. Asks twice. */
function DeleteAccount() {
  const { role, setRole, setMe } = useRole();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (role === 'staff') {
    return (
      <Card>
        <Text variant="small" color="secondary">
          Staff accounts are closed by Team Impact, not from the app.
        </Text>
      </Card>
    );
  }

  const remove = () => {
    setBusy(true);
    api.deleteAccount().then(
      () => {
        setMe(null);
        setRole(null);
        router.replace('/welcome');
      },
      (e: Error) => {
        setError(e.message);
        setBusy(false);
      },
    );
  };

  return (
    <Card>
      <Text weight="semibold">Delete my account</Text>
      <Text variant="small" color="secondary">
        Your profile, posts and card disappear right away and are erased for good after 30 days.
        {role === 'parent' ? ' Your children’s profiles are deleted with your account.' : ''}
      </Text>
      {confirming ? (
        <View style={styles.buttons}>
          <Button
            label="Keep account"
            variant="secondary"
            stretch
            onPress={() => setConfirming(false)}
          />
          <Button label="Delete for good" stretch disabled={busy} onPress={remove} />
        </View>
      ) : (
        <Button label="Delete account" variant="secondary" onPress={() => setConfirming(true)} />
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </Card>
  );
}

/** "/me/safety": blocked people, your reports, and deleting your account (PRD §9). */
export default function Safety() {
  return (
    <Screen eyebrow="Me" title="Safety" back>
      <SectionLabel>Blocked</SectionLabel>
      <Gutter>
        <Blocked />
      </Gutter>
      <SectionLabel>Your reports</SectionLabel>
      <Gutter>
        <Reports />
      </Gutter>
      <SectionLabel>Account</SectionLabel>
      <Gutter>
        <DeleteAccount />
      </Gutter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  buttons: { flexDirection: 'row', gap: spacing.sm },
});
