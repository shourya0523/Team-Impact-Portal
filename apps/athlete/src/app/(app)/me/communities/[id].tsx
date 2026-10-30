import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { canJoinCommunity, type Community } from '@team-impact/contracts';
import { colors, layout, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { KIND_LABEL, ROLE_LABEL, shortDate } from '@/components/format';
import { ReportButton } from '@/components/Report';
import { CommunityEvents, CommunityMembers } from '@/components/community-tabs';
import { Async, ErrorText, SCROLL_END, Segmented } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { KIND_STYLE, monogram } from '@/theme';
import { Avatar, Badge, Button, Card, Icon, Text } from '@/ui';

const COVER = 196;

type Tab = 'posts' | 'events' | 'members';
const TABS: { value: Tab; label: string }[] = [
  { value: 'posts', label: 'Posts' },
  { value: 'events', label: 'Events' },
  { value: 'members', label: 'Members' },
];
/** Joining or leaving changes what the Events and Members tabs may show, so they reload. */
const tabKey = (x: Community) => `${x.id}:${x.myMembership ? 'in' : 'out'}`;
const SWITCH_W = 56;
const SWITCH_H = 32;
const KNOB = 26;

/** "Recruiters can find me through this community": separate from joining (PRD §7). */
function Findable({
  community,
  onChange,
}: {
  community: Community & { kind: 'interest' };
  onChange: (c: Community) => void;
}) {
  const on = community.myMembership?.recruiterSearchOptIn ?? false;
  const [error, setError] = useState<string | null>(null);
  const toggle = () =>
    api.setFindable(community.id, !on).then(onChange, (e: Error) => setError(e.message));
  return (
    <Card>
      <View style={styles.findable}>
        <View style={styles.findableText}>
          <Text weight="semibold">Recruiters can find me through this community</Text>
          <Text variant="small" color="secondary">
            Separate from joining. Only your published Baseball Card shows, and every search like
            this is logged. Turn it off anytime.
          </Text>
        </View>
        <Pressable
          onPress={toggle}
          accessibilityRole="switch"
          accessibilityState={{ checked: on }}
          accessibilityLabel="Recruiters can find me through this community"
          style={[
            styles.switch,
            {
              backgroundColor: on ? colors.brand : colors.text.muted,
              alignItems: on ? 'flex-end' : 'flex-start',
            },
          ]}
        >
          <View style={styles.knob} />
        </Pressable>
      </View>
      {error && <ErrorText>{error}</ErrorText>}
    </Card>
  );
}

/** The creator's queue for a private community: approve or decline each request. */
function JoinRequests({ communityId, onChange }: { communityId: string; onChange: () => void }) {
  const { state, reload } = useApi(() => api.communityJoinRequests(communityId), [communityId]);
  const decide = (userId: string, decision: 'approve' | 'decline') =>
    api.decideCommunityJoin(communityId, userId, decision).then(() => {
      reload();
      onChange();
    });
  return (
    <Async state={state}>
      {(requests) =>
        requests.length > 0 && (
          <Card>
            <Text weight="semibold">Asking to join · {requests.length}</Text>
            {requests.map((r) => (
              <View key={r.user.id} style={styles.person}>
                <Avatar name={`${r.user.firstName} ${r.user.lastName}`} role={r.user.role} />
                <View style={styles.grow}>
                  <Text weight="semibold">
                    {r.user.firstName} {r.user.lastName}
                  </Text>
                  <Text variant="caption" weight="medium" color="muted">
                    {ROLE_LABEL[r.user.role]} · asked {shortDate(r.requestedAt)}
                  </Text>
                </View>
                <Button
                  label="Decline"
                  variant="secondary"
                  size="sm"
                  onPress={() => decide(r.user.id, 'decline')}
                />
                <Button
                  label="Approve"
                  variant="brand"
                  size="sm"
                  onPress={() => decide(r.user.id, 'approve')}
                />
              </View>
            ))}
          </Card>
        )
      }
    </Async>
  );
}

/** "/me/communities/[id]": a community's page and its own feed. */
export default function CommunityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role, me } = useRole();
  const insets = useSafeAreaInsets();
  const community = useApi(() => api.community(id), [id]);
  const posts = useApi(() => api.communityPosts(id), [id]);
  const [override, setOverride] = useState<Community | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('posts');

  const leave = () =>
    api.leaveCommunity(id).then(
      (x) => {
        setOverride(x);
        posts.reload();
      },
      (e: Error) => setError(e.message),
    );

  const join = () =>
    api.joinCommunity(id).then(
      (x) => {
        setOverride(x);
        posts.reload();
      },
      (e: Error) => setError(e.message),
    );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <Async state={community.state}>
        {(loaded) => {
          const x = override ?? loaded;
          const k = KIND_STYLE[x.kind];
          const official = x.kind === 'interest' && x.official;
          const userMade = x.kind === 'interest' || x.kind === 'medical' ? x : null;
          const isPrivate = userMade?.private ?? false;
          const isCreator = !!me && userMade?.createdBy.id === me.id;
          const canPost =
            x.myMembership &&
            role !== 'parent' &&
            role !== 'recruiter' &&
            !(role === 'teen' && x.kind !== 'team');
          return (
            <ScrollView contentContainerStyle={styles.scroll}>
              <View style={[styles.cover, { backgroundColor: k.band, paddingTop: insets.top }]}>
                {isPrivate ? (
                  <View style={styles.coverLock}>
                    <Icon name="lock" size={120} color={k.monogram} strokeWidth={1.4} />
                  </View>
                ) : (
                  <Text
                    variant="decor"
                    size="xl"
                    style={[styles.coverMonogram, { color: k.monogram }]}
                  >
                    {x.kind === 'team_impact' ? 'TI' : monogram(x.name, x.kind === 'team')}
                  </Text>
                )}
                <Pressable
                  onPress={() => router.back()}
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  style={[styles.back, { top: insets.top + spacing.md }]}
                >
                  <Icon name="back" size={20} color={colors.ink} />
                </Pressable>
                <Badge
                  variant="ink"
                  caps
                  icon={official ? 'shield' : isPrivate ? 'lock' : 'users'}
                  label={
                    official
                      ? 'Official'
                      : isPrivate
                        ? `Private ${KIND_LABEL[x.kind]}`
                        : KIND_LABEL[x.kind]
                  }
                />
              </View>

              <View style={styles.body}>
                <View style={styles.between}>
                  <View style={[styles.titleBlock, styles.grow]}>
                    <Text variant="display" size="lg" color="brand">
                      {x.name}
                    </Text>
                    <Text color="secondary">{x.about}</Text>
                  </View>
                  {userMade && !isCreator && (
                    <ReportButton target={{ kind: 'community', id: x.id }} />
                  )}
                </View>

                <View style={styles.between}>
                  <Text variant="small" color="secondary">
                    <Text variant="small" weight="semibold">
                      {x.memberCount} members
                    </Text>
                    {x.myMembership ? ` · joined ${shortDate(x.myMembership.joinedAt)}` : ''}
                  </Text>
                  {canPost ? (
                    <Button
                      label="Post"
                      size="sm"
                      onPress={() =>
                        router.push({ pathname: '/home/compose', params: { communityId: x.id } })
                      }
                    />
                  ) : (
                    !x.myMembership &&
                    role &&
                    canJoinCommunity(role, x.kind) &&
                    (userMade?.myJoinRequest ? (
                      <Button
                        label="Requested"
                        variant="secondary"
                        size="sm"
                        disabled
                        onPress={() => undefined}
                      />
                    ) : (
                      <Button
                        label={isPrivate ? 'Ask to join' : 'Join'}
                        variant="brand"
                        size="sm"
                        onPress={join}
                      />
                    ))
                  )}
                </View>
                {error && <ErrorText>{error}</ErrorText>}

                {userMade && x.myMembership && !isCreator && (
                  <Button label="Leave community" variant="secondary" size="sm" onPress={leave} />
                )}

                {x.kind === 'medical' && x.myMembership && (
                  <Card style={[styles.note, styles.noteTint]}>
                    <Icon name="lock" size={18} color={colors.brand} />
                    <Text variant="small" color="brand" style={styles.grow}>
                      Your membership is private. It never shows on your profile, in search or to
                      recruiters.
                    </Text>
                  </Card>
                )}

                {isPrivate && !x.myMembership && (
                  <Card style={styles.note}>
                    <Icon name="lock" size={18} color={colors.brand} />
                    <Text variant="small" color="secondary" style={styles.grow}>
                      {userMade?.myJoinRequest
                        ? `You asked to join. ${userMade.createdBy.firstName} will let you in.`
                        : `Private community. Posts and members are for members only; ${userMade?.createdBy.firstName} approves new members.`}
                    </Text>
                  </Card>
                )}

                {isPrivate && isCreator && (
                  <JoinRequests communityId={x.id} onChange={() => community.reload()} />
                )}

                {x.kind === 'interest' &&
                  x.official &&
                  x.myMembership &&
                  (role === 'athlete' || role === 'alumni_athlete') && (
                    <Findable community={x} onChange={setOverride} />
                  )}

                <View style={styles.tabs}>
                  <Segmented
                    label="Community sections"
                    options={TABS}
                    value={tab}
                    onChange={setTab}
                  />
                </View>
                {tab === 'events' && <CommunityEvents key={tabKey(x)} community={x} />}
                {tab === 'members' && <CommunityMembers key={tabKey(x)} community={x} />}
                {tab === 'posts' && (
                  <Async state={posts.state}>
                    {(page) =>
                      page.items.length ? (
                        page.items.map((p) => (
                          <Card key={p.id}>
                            <View style={styles.person}>
                              {p.kind === 'announcement' ? (
                                // From Team Impact, not the staff member who wrote it.
                                <View style={styles.grow}>
                                  <Badge
                                    label="Team IMPACT announcement"
                                    variant="brand"
                                    icon="megaphone"
                                    caps
                                  />
                                  <Text variant="caption" weight="medium" color="muted">
                                    {shortDate(p.createdAt)}
                                  </Text>
                                </View>
                              ) : (
                                <>
                                  <Avatar
                                    name={`${p.author.firstName} ${p.author.lastName}`}
                                    role={p.author.role}
                                  />
                                  <View style={styles.grow}>
                                    <Text weight="semibold">
                                      {p.author.firstName} {p.author.lastName}
                                    </Text>
                                    <Text variant="caption" weight="medium" color="muted">
                                      {ROLE_LABEL[p.author.role]} · {shortDate(p.createdAt)}
                                    </Text>
                                  </View>
                                </>
                              )}
                              {p.author.id !== me?.id && !p.official && (
                                <ReportButton
                                  target={{ kind: 'post', id: p.id }}
                                  author={
                                    p.author.role === 'staff'
                                      ? undefined
                                      : { id: p.author.id, name: p.author.firstName }
                                  }
                                  onDone={posts.reload}
                                />
                              )}
                            </View>
                            <Text>
                              {p.kind === 'opportunity'
                                ? `${p.opportunity.title} at ${p.opportunity.company.name}`
                                : p.text}
                            </Text>
                          </Card>
                        ))
                      ) : (
                        <Text variant="small" color="secondary">
                          {x.myMembership
                            ? 'No posts yet. Start the conversation.'
                            : 'Join to see posts here.'}
                        </Text>
                      )
                    }
                  </Async>
                )}
              </View>
            </ScrollView>
          );
        }}
      </Async>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  scroll: { paddingBottom: SCROLL_END },
  cover: {
    height: COVER,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  coverMonogram: { position: 'absolute', right: -10, bottom: -50 },
  coverLock: { position: 'absolute', right: 10, bottom: -10 },
  back: {
    position: 'absolute',
    left: 16,
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: layout.minTouchTarget / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: spacing.md, gap: spacing.md },
  titleBlock: { gap: spacing.xs },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  note: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  noteTint: { backgroundColor: colors.brandTint, borderColor: colors.brandTint },
  tabs: { marginTop: spacing.xs },
  findable: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  findableText: { flex: 1, gap: spacing.xs },
  switch: {
    width: SWITCH_W,
    height: SWITCH_H,
    borderRadius: SWITCH_H / 2,
    padding: (SWITCH_H - KNOB) / 2,
    justifyContent: 'center',
  },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: colors.surface },
});
