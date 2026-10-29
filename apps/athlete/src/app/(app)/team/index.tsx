import { router, useFocusEffect } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import type { JoinRequest, TeamMember, TeamRoster } from '@team-impact/contracts';
import { spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { ROLE_LABEL, shortDate } from '@/components/format';
import { fullName, joinedLine, nameList, NoTeam, PersonRow, useTeamId } from '@/components/team';
import { Async, ErrorText, Gutter, Screen, Segmented } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { Badge, Button, Card, Text } from '@/ui';

type Tab = 'athletes' | 'families' | 'coaches' | 'teens';

const requestDetail = (r: JoinRequest) => {
  const asked = `asked ${shortDate(r.createdAt)}`;
  if (r.role === 'athlete') return `Athlete · Class of ${r.classYear} · ${asked}`;
  if (r.role === 'parent') {
    return `${r.relationship === 'guardian' ? 'Guardian' : 'Parent'} · ${asked}`;
  }
  return `${ROLE_LABEL.teen} · ${asked}`;
};

/** Join requests waiting on the coach: the slow lane. Nothing about the team shows until approved. */
function Approvals({
  teamId,
  waiting,
  onChange,
}: {
  teamId: string;
  /** The roster's request count: when it changes, the queue loads again (and keeps `done`). */
  waiting: number | null;
  onChange: () => void;
}) {
  const { state, reload } = useApi(() => api.teamJoinRequests(teamId), [teamId, waiting]);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);
  /** The last decision, e.g. "Kai Brooks is on the team." Outside the list, so it outlives the last row. */
  const [done, setDone] = useState<string | null>(null);

  const decide = (r: JoinRequest, decision: 'approve' | 'decline') => {
    setDeciding(r.id);
    setError(null);
    setDone(null);
    return api.decideJoinRequest(r.id, decision).then(
      () => {
        setDeciding(null);
        setDone(
          `${fullName(r.requester)} ${decision === 'approve' ? 'is on the team' : 'was declined'}.`,
        );
        reload();
        onChange();
      },
      (e: Error) => {
        setError(e.message);
        setDeciding(null);
      },
    );
  };
  return (
    <Async state={state} onRetry={reload}>
      {(requests) => (
        <>
          {done && (
            <Text variant="small" color="success">
              {done}
            </Text>
          )}
          {requests.length === 0 ? (
            <Text variant="small" color="secondary">
              Nobody is asking to join right now.
            </Text>
          ) : (
            <Card>
              <View style={styles.between}>
                <Text weight="semibold">Asking to join</Text>
                <Badge label={`${requests.length} waiting`} variant="action" caps />
              </View>
              {requests.map((r) => (
                <View key={r.id} style={styles.request}>
                  <PersonRow user={r.requester} detail={requestDetail(r)} />
                  <View style={styles.buttons}>
                    <Button
                      label={deciding === r.id ? 'Declining…' : 'Decline'}
                      variant="secondary"
                      size="sm"
                      stretch
                      disabled={deciding !== null}
                      accessibilityLabel={`Decline ${fullName(r.requester)}`}
                      onPress={() => decide(r, 'decline')}
                    />
                    <Button
                      label={deciding === r.id ? 'Approving…' : 'Approve'}
                      variant="brand"
                      size="sm"
                      stretch
                      disabled={deciding !== null}
                      accessibilityLabel={`Approve ${fullName(r.requester)}`}
                      onPress={() => decide(r, 'approve')}
                    />
                  </View>
                </View>
              ))}
              {error && <ErrorText>{error}</ErrorText>}
            </Card>
          )}
        </>
      )}
    </Async>
  );
}

function RemoveButton({ member, myId }: { member: TeamMember; myId: string | undefined }) {
  if (member.user.id === myId) return null;
  return (
    <Button
      label="Remove"
      variant="secondary"
      size="sm"
      accessibilityLabel={`Remove ${fullName(member.user)}`}
      onPress={() => router.push({ pathname: '/team/remove', params: { userId: member.user.id } })}
    />
  );
}

function Members({ roster, tab }: { roster: TeamRoster; tab: Tab }) {
  const { me } = useRole();
  const manage = roster.canManage;
  const right = (m: TeamMember) => manage && <RemoveButton member={m} myId={me?.id} />;

  if (tab === 'families') {
    if (!roster.parents.length) return <Empty what="families" />;
    return (
      <Card>
        {roster.parents.map((p) => (
          <PersonRow key={p.user.id} user={p.user} detail={joinedLine(p)} right={right(p)}>
            {p.children.length > 0 && (
              <Text variant="small" color="secondary">
                Parent of {nameList(p.children.map((c) => c.firstName))}
              </Text>
            )}
            {/* Only the team's own coaches get these; the API sends null to everyone else. */}
            {p.contact?.email && (
              <Text
                variant="small"
                color="brand"
                accessibilityRole="link"
                onPress={() => Linking.openURL(`mailto:${p.contact!.email}`)}
              >
                {p.contact.email}
              </Text>
            )}
            {p.contact?.phone && (
              <Text
                variant="small"
                color="brand"
                accessibilityRole="link"
                onPress={() => Linking.openURL(`tel:${p.contact!.phone!.replace(/[^+\d]/g, '')}`)}
              >
                {p.contact.phone}
              </Text>
            )}
          </PersonRow>
        ))}
      </Card>
    );
  }

  const list = roster[tab];
  if (!list.length) return <Empty what={tab} />;
  return (
    <Card>
      {list.map((m) => (
        <PersonRow key={m.user.id} user={m.user} detail={joinedLine(m)} right={right(m)} />
      ))}
    </Card>
  );
}

function Empty({ what }: { what: string }) {
  return (
    <Text variant="small" color="secondary">
      No {what} on the team yet.
    </Text>
  );
}

function CoachTools() {
  return (
    <View style={styles.tools}>
      <Button label="QR code" icon="qr" size="sm" onPress={() => router.push('/team/qr')} />
      <Button
        label="Add a coach"
        icon="plus"
        variant="secondary"
        size="sm"
        onPress={() => router.push('/team/add-coach')}
      />
      <Button
        label="Edit team"
        variant="secondary"
        size="sm"
        onPress={() => router.push('/team/edit')}
      />
    </View>
  );
}

/**
 * "/team": the roster for everyone on the team, grouped by role. Coaches also get join approvals,
 * removing members, the QR code, adding coaches and editing the team. Families' contact details
 * reach the team's coaches only; teens never see anyone's (PRD §6).
 */
export default function TeamScreen() {
  const { role } = useRole();
  const teamId = useTeamId();
  const [tab, setTab] = useState<Tab>('athletes');
  const roster = useApi(() => (teamId ? api.roster(teamId) : Promise.resolve(null)), [teamId]);
  // Back from removing someone or editing the team: show what changed.
  useFocusEffect(roster.reload);

  const loaded = roster.state.status === 'ready' ? roster.state.data : null;
  const waiting = loaded?.pendingRequestCount ?? 0;

  return (
    <Screen
      eyebrow={loaded ? loaded.team.college.name : 'Team'}
      title={loaded ? loaded.team.name : 'Your team'}
      right={waiting > 0 && <Badge label={`${waiting} to approve`} variant="action" caps />}
    >
      <Gutter>
        <Async state={roster.state} onRetry={roster.reload}>
          {(r) =>
            !r || !teamId ? (
              <NoTeam />
            ) : (
              <>
                {r.canManage && <CoachTools />}
                {r.canManage && (
                  <Approvals
                    teamId={teamId}
                    waiting={r.pendingRequestCount}
                    onChange={roster.reload}
                  />
                )}
                <Segmented
                  label="Roster"
                  value={tab}
                  onChange={setTab}
                  options={[
                    { value: 'athletes', label: `Athletes ${r.athletes.length}` },
                    { value: 'families', label: `Families ${r.parents.length}` },
                    { value: 'coaches', label: `Coaches ${r.coaches.length}` },
                    ...(r.teens.length
                      ? [{ value: 'teens' as const, label: `Teens ${r.teens.length}` }]
                      : []),
                  ]}
                />
                <Members roster={r} tab={tab} />
                {role === 'teen' && (
                  <Text variant="small" color="secondary">
                    Contact details stay private between athletes, families and coaches.
                  </Text>
                )}
              </>
            )
          }
        </Async>
      </Gutter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  request: { gap: spacing.sm, paddingVertical: spacing.xs },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
