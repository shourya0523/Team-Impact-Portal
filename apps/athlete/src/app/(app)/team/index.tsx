import { router, useFocusEffect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { JoinRequest, SharedContact, TeamMember, TeamRoster } from '@team-impact/contracts';
import { spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { ContactLinks, hasContact } from '@/components/contact';
import { ROLE_LABEL, shortDate } from '@/components/format';
import {
  fullName,
  joinedLine,
  nameList,
  NoTeam,
  openProfile,
  PersonRow,
  useTeamId,
} from '@/components/team';
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
function Approvals({ teamId, onChange }: { teamId: string; onChange: () => void }) {
  const { state, reload } = useApi(() => api.teamJoinRequests(teamId), [teamId]);
  const [error, setError] = useState<string | null>(null);
  const decide = (id: string, decision: 'approve' | 'decline') =>
    api.decideJoinRequest(id, decision).then(
      () => {
        setError(null);
        reload();
        onChange();
      },
      (e: Error) => setError(e.message),
    );
  return (
    <Async state={state}>
      {(requests) =>
        requests.length > 0 && (
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
                    label="Decline"
                    variant="secondary"
                    size="sm"
                    stretch
                    accessibilityLabel={`Decline ${fullName(r.requester)}`}
                    onPress={() => decide(r.id, 'decline')}
                  />
                  <Button
                    label="Approve"
                    variant="brand"
                    size="sm"
                    stretch
                    accessibilityLabel={`Approve ${fullName(r.requester)}`}
                    onPress={() => decide(r.id, 'approve')}
                  />
                </View>
              </View>
            ))}
            {error && <ErrorText>{error}</ErrorText>}
          </Card>
        )
      }
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

/** Athlete id to what they share with families. Only loaded for parents (see `TeamScreen`). */
type FamilyContacts = ReadonlyMap<string, SharedContact>;

function Members({
  roster,
  tab,
  familyContacts,
}: {
  roster: TeamRoster;
  tab: Tab;
  familyContacts: FamilyContacts | null;
}) {
  const { me } = useRole();
  const manage = roster.canManage;
  const right = (m: TeamMember) => manage && <RemoveButton member={m} myId={me?.id} />;

  if (tab === 'families') {
    if (!roster.parents.length) return <Empty what="families" />;
    return (
      <Card>
        {roster.parents.map((p) => (
          <PersonRow
            key={p.user.id}
            user={p.user}
            detail={joinedLine(p)}
            right={right(p)}
            onPress={() => openProfile(p.user.id)}
          >
            {p.children.length > 0 && (
              <Text variant="small" color="secondary">
                Parent of {nameList(p.children.map((c) => c.firstName))}
              </Text>
            )}
            {/* Only the team's own coaches get these; the API sends null to everyone else. */}
            {p.contact && <ContactLinks contact={p.contact} ownerId={p.user.id} />}
          </PersonRow>
        ))}
      </Card>
    );
  }

  if (tab === 'athletes') {
    if (!roster.athletes.length) return <Empty what="athletes" />;
    return (
      <Card>
        {roster.athletes.map((a) => (
          <PersonRow
            key={a.user.id}
            user={a.user}
            detail={joinedLine(a)}
            right={right(a)}
            onPress={() => openProfile(a.user.id)}
          >
            {familyContacts && (
              <AthleteContact contact={familyContacts.get(a.user.id)} ownerId={a.user.id} />
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
        <PersonRow
          key={m.user.id}
          user={m.user}
          detail={joinedLine(m)}
          right={right(m)}
          onPress={() => openProfile(m.user.id)}
        />
      ))}
    </Card>
  );
}

/** What a parent sees under an athlete: the contacts the athlete shares with families (PRD F4). */
function AthleteContact({
  contact,
  ownerId,
}: {
  contact: SharedContact | undefined;
  ownerId: string;
}) {
  if (!contact || !hasContact(contact)) {
    return (
      <Text variant="small" color="muted">
        Hasn’t shared contact details with families
      </Text>
    );
  }
  return <ContactLinks contact={contact} ownerId={ownerId} />;
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
 * reach the team's coaches only; parents see the contacts each athlete shares with families; teens
 * never see anyone's (PRD §6).
 */
export default function TeamScreen() {
  const { role } = useRole();
  const teamId = useTeamId();
  const [tab, setTab] = useState<Tab>('athletes');
  const roster = useApi(() => (teamId ? api.roster(teamId) : Promise.resolve(null)), [teamId]);
  // Athletes' family contacts come from their own route, for parents only: the roster itself
  // never carries them, so nobody else (teens included) is ever sent one.
  const parent = role === 'parent';
  const contacts = useApi(
    () =>
      teamId && parent
        ? api
            .athleteContacts(teamId)
            .then((list): FamilyContacts => new Map(list.map((a) => [a.athlete.id, a.contact])))
        : Promise.resolve(null),
    [teamId, parent],
  );
  // Back from removing someone or editing the team, or after an athlete changed what they share.
  useFocusEffect(roster.reload);
  useFocusEffect(contacts.reload);
  // Shown only once loaded: while loading, or if loading fails, the roster shows without them
  // rather than wrongly saying an athlete shares nothing.
  const familyContacts = contacts.state.status === 'ready' ? contacts.state.data : null;

  const loaded = roster.state.status === 'ready' ? roster.state.data : null;
  const waiting = loaded?.pendingRequestCount ?? 0;

  return (
    <Screen
      eyebrow={loaded ? loaded.team.college.name : 'Team'}
      title={loaded ? loaded.team.name : 'Your team'}
      right={waiting > 0 && <Badge label={`${waiting} to approve`} variant="action" caps />}
    >
      <Gutter>
        <Async state={roster.state}>
          {(r) =>
            !r || !teamId ? (
              <NoTeam />
            ) : (
              <>
                {r.canManage && <CoachTools />}
                {r.canManage && (
                  <Approvals key={r.pendingRequestCount} teamId={teamId} onChange={roster.reload} />
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
                <Members roster={r} tab={tab} familyContacts={familyContacts} />
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
