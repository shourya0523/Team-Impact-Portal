import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { canJoinCommunity, type Community } from '@team-impact/contracts';
import { api } from '@/api';
import { KIND_LABEL, ROLE_LABEL, shortDate } from '@/components/format';
import { Icon } from '@/components/Icon';
import { Async, Avatar, Button, Card, type } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { c, font, KIND_STYLE, monogram } from '@/theme';

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
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[type.name, { fontSize: 16 }]}>
            Recruiters can find me through this community
          </Text>
          <Text style={type.small}>
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
            { backgroundColor: on ? c.navy : c.line, alignItems: on ? 'flex-end' : 'flex-start' },
          ]}
        >
          <View style={styles.knob} />
        </Pressable>
      </View>
      {error && <Text style={{ color: c.danger, fontFamily: font.medium }}>{error}</Text>}
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
            <Text style={type.name}>Asking to join · {requests.length}</Text>
            {requests.map((r) => (
              <View key={r.user.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar
                  firstName={r.user.firstName}
                  lastName={r.user.lastName}
                  role={r.user.role}
                />
                <View style={{ flex: 1 }}>
                  <Text style={type.name}>
                    {r.user.firstName} {r.user.lastName}
                  </Text>
                  <Text style={type.meta}>
                    {ROLE_LABEL[r.user.role]} · asked {shortDate(r.requestedAt)}
                  </Text>
                </View>
                <Button
                  label="Decline"
                  kind="outline"
                  size="sm"
                  onPress={() => decide(r.user.id, 'decline')}
                />
                <Button
                  label="Approve"
                  kind="navy"
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

  const join = () =>
    api.joinCommunity(id).then(
      (x) => {
        setOverride(x);
        posts.reload();
      },
      (e: Error) => setError(e.message),
    );

  return (
    <View style={{ flex: 1, backgroundColor: c.ground }}>
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
            <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
              <View style={[styles.cover, { backgroundColor: k.band, paddingTop: insets.top }]}>
                {isPrivate ? (
                  <View style={styles.coverLock}>
                    <Icon name="lock" size={120} color={k.monogram} strokeWidth={1.4} />
                  </View>
                ) : (
                  <Text style={[styles.coverMonogram, { color: k.monogram }]}>
                    {x.kind === 'team_impact' ? 'TI' : monogram(x.name, x.kind === 'team')}
                  </Text>
                )}
                <Pressable
                  onPress={() => router.back()}
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  style={[styles.back, { top: insets.top + 16 }]}
                >
                  <Icon name="back" size={20} color={c.ink} />
                </Pressable>
                <View style={styles.coverTag}>
                  <Icon
                    name={official ? 'shield' : isPrivate ? 'lock' : 'users'}
                    size={13}
                    color="#fff"
                    strokeWidth={2.4}
                  />
                  <Text
                    style={{
                      color: '#fff',
                      fontFamily: font.bold,
                      fontSize: 12,
                      letterSpacing: 1.2,
                    }}
                  >
                    {official
                      ? 'OFFICIAL'
                      : isPrivate
                        ? `PRIVATE ${KIND_LABEL[x.kind].toUpperCase()}`
                        : KIND_LABEL[x.kind].toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={{ padding: 20, gap: 14 }}>
                <View style={{ gap: 4 }}>
                  <Text
                    style={[type.display, { fontSize: 40, lineHeight: 39 }]}
                    accessibilityRole="header"
                  >
                    {x.name.toUpperCase()}
                  </Text>
                  <Text style={[type.small, { fontSize: 15, lineHeight: 21 }]}>{x.about}</Text>
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <Text style={type.small}>
                    <Text style={{ fontFamily: font.bold, color: c.ink }}>
                      {x.memberCount} members
                    </Text>
                    {x.myMembership ? ` · joined ${shortDate(x.myMembership.joinedAt)}` : ''}
                  </Text>
                  {canPost ? (
                    <Button label="Post" size="sm" onPress={() => router.push('/home/compose')} />
                  ) : (
                    !x.myMembership &&
                    role &&
                    canJoinCommunity(role, x.kind) &&
                    (userMade?.myJoinRequest ? (
                      <Button
                        label="Requested"
                        kind="outline"
                        size="sm"
                        disabled
                        onPress={() => undefined}
                      />
                    ) : (
                      <Button
                        label={isPrivate ? 'Ask to join' : 'Join'}
                        kind="navy"
                        size="sm"
                        onPress={join}
                      />
                    ))
                  )}
                </View>
                {error && <Text style={{ color: c.danger, fontFamily: font.medium }}>{error}</Text>}

                {x.kind === 'medical' && x.myMembership && (
                  <Card
                    style={{
                      flexDirection: 'row',
                      gap: 10,
                      alignItems: 'center',
                      backgroundColor: c.navyTint,
                      borderColor: c.navyTint,
                    }}
                  >
                    <Icon name="lock" size={18} color={c.navy} />
                    <Text style={[type.small, { flex: 1, color: c.navy }]}>
                      Your membership is private. It never shows on your profile, in search or to
                      recruiters.
                    </Text>
                  </Card>
                )}

                {isPrivate && !x.myMembership && (
                  <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <Icon name="lock" size={18} color={c.navy} />
                    <Text style={[type.small, { flex: 1 }]}>
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

                <Text style={[type.name, { marginTop: 4 }]}>Posts</Text>
                <Async state={posts.state}>
                  {(page) =>
                    page.items.length ? (
                      page.items.map((p) => (
                        <Card key={p.id}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Avatar
                              firstName={p.author.firstName}
                              lastName={p.author.lastName}
                              role={p.author.role}
                            />
                            <View>
                              <Text style={type.name}>
                                {p.author.firstName} {p.author.lastName}
                              </Text>
                              <Text style={type.meta}>
                                {ROLE_LABEL[p.author.role]} · {shortDate(p.createdAt)}
                              </Text>
                            </View>
                          </View>
                          <Text style={type.body}>
                            {p.kind === 'opportunity'
                              ? `${p.opportunity.title} at ${p.opportunity.company.name}`
                              : p.text}
                          </Text>
                        </Card>
                      ))
                    ) : (
                      <Text style={type.small}>
                        {x.myMembership
                          ? 'No posts yet. Start the conversation.'
                          : 'Join to see posts here.'}
                      </Text>
                    )
                  }
                </Async>
              </View>
            </ScrollView>
          );
        }}
      </Async>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { height: 196, overflow: 'hidden', justifyContent: 'flex-end', padding: 20 },
  coverMonogram: {
    position: 'absolute',
    right: -10,
    bottom: -50,
    fontFamily: font.display,
    fontSize: 200,
    lineHeight: 210,
  },
  coverLock: { position: 'absolute', right: 10, bottom: -10 },
  back: {
    position: 'absolute',
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: c.ink,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  switch: { width: 56, height: 32, borderRadius: 16, padding: 3, justifyContent: 'center' },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff' },
});
