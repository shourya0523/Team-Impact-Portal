import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Community, Post } from '@team-impact/contracts';
import { api } from '@/api';
import { ROLE_LABEL, shortDate } from '@/components/format';
import { Icon } from '@/components/Icon';
import { Async, Avatar, Card, Chip, Gutter, IconButton, Screen, Tag, type } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { c, font, KIND_STYLE, monogram } from '@/theme';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

type Filter = 'all' | 'team' | 'communities';

/**
 * A row of the communities you're in, like stories. Medical communities never show their name
 * here (PRD §5: membership stays private), only a lock that opens your communities.
 */
function CommunityBubbles({ communities }: { communities: Community[] }) {
  const mine = communities.filter((x) => x.myMembership);
  const hasPrivate = mine.some((x) => x.kind === 'medical');
  const shown = mine.filter((x) => x.kind !== 'medical');
  const open = (id: string) => router.push({ pathname: '/me/communities/[id]', params: { id } });
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
      accessibilityLabel="Your communities"
    >
      {shown.map((x) => {
        const k = KIND_STYLE[x.kind];
        const label = x.kind === 'team' ? 'My team' : x.name.split(' ')[0]!;
        return (
          <Pressable
            key={x.id}
            onPress={() => open(x.id)}
            accessibilityRole="button"
            accessibilityLabel={x.name}
            style={styles.bubble}
          >
            <View style={[styles.ring, { borderColor: c.red }]}>
              <View style={[styles.bubbleFill, { backgroundColor: k.band }]}>
                <Text
                  style={[styles.bubbleText, { color: x.kind === 'interest' ? c.ink : '#fff' }]}
                >
                  {x.kind === 'team_impact' ? 'TI' : monogram(x.name, x.kind === 'team')}
                </Text>
              </View>
            </View>
            <Text style={styles.bubbleLabel} numberOfLines={1}>
              {x.kind === 'team_impact' ? 'Team Impact' : label}
            </Text>
          </Pressable>
        );
      })}
      {hasPrivate && (
        <Pressable
          onPress={() => router.push('/me/communities')}
          accessibilityRole="button"
          accessibilityLabel="Your private communities"
          style={styles.bubble}
        >
          <View style={[styles.ring, { borderColor: c.line }]}>
            <View style={[styles.bubbleFill, { backgroundColor: c.navyTint }]}>
              <Icon name="lock" size={22} color={c.navy} />
            </View>
          </View>
          <Text style={styles.bubbleLabel}>Private</Text>
        </Pressable>
      )}
      <Pressable
        onPress={() => router.push('/me/communities')}
        accessibilityRole="button"
        style={styles.bubble}
      >
        <View
          style={[
            styles.ring,
            {
              borderStyle: 'dashed',
              borderColor: '#8a8f98',
              borderWidth: 2,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Icon name="plus" size={24} color={c.text2} />
        </View>
        <Text style={styles.bubbleLabel}>Find more</Text>
      </Pressable>
    </ScrollView>
  );
}

function Rally({ count }: { count: number }) {
  // Local until the like endpoint lands; the count moves so the control feels real.
  const [on, setOn] = useState(false);
  return (
    <Pressable
      onPress={() => setOn((v) => !v)}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.action, on ? { backgroundColor: c.redTint, borderColor: c.redTint } : null]}
    >
      <Icon
        name="heart"
        size={16}
        color={on ? c.redPressed : c.ink}
        fill={on ? c.redPressed : 'none'}
      />
      <Text style={[styles.actionText, on && { color: c.redPressed }]}>
        Rally · {count + (on ? 1 : 0)}
      </Text>
    </Pressable>
  );
}

function Announcement({ post }: { post: Post }) {
  return (
    <View style={styles.announcement}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={styles.megaphone}>
          <Icon name="megaphone" size={18} color="#fff" />
        </View>
        <View>
          <Text style={[type.name, { color: '#fff' }]}>Team IMPACT</Text>
          <Text style={[type.meta, { color: c.onNavy }]}>
            Announcement · {shortDate(post.createdAt)}
          </Text>
        </View>
      </View>
      <Text style={styles.announcementText}>{post.text}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Rally count={post.likeCount} />
      </View>
    </View>
  );
}

function PostCard({ post }: { post: Post }) {
  if (post.kind === 'announcement') return <Announcement post={post} />;
  const where =
    post.community.kind === 'team'
      ? `Team only · ${post.community.name}`
      : `in ${post.community.name}`;
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {post.kind === 'opportunity' ? (
          <View style={styles.company}>
            <Text style={{ color: '#fff', fontFamily: font.bold, fontSize: 14 }}>
              {monogram(post.opportunity.company.name)}
            </Text>
          </View>
        ) : (
          <Avatar
            firstName={post.author.firstName}
            lastName={post.author.lastName}
            role={post.author.role}
          />
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={type.name}>
              {post.kind === 'opportunity'
                ? post.opportunity.company.name
                : `${post.author.firstName} ${post.author.lastName}`}
            </Text>
            {post.kind === 'post' && post.author.role !== 'athlete' && (
              <Tag label={ROLE_LABEL[post.author.role]} />
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {post.community.kind === 'team' && (
              <Icon name="lock" size={12} color={c.muted} strokeWidth={2.4} />
            )}
            <Text style={type.meta} numberOfLines={1}>
              {post.kind === 'opportunity' ? 'Opportunity · ' : ''}
              {where} · {shortDate(post.createdAt)}
            </Text>
          </View>
        </View>
      </View>
      {post.moderation !== 'approved' && (
        <Tag label="Waiting for review" bg={c.warnBg} fg={c.warnFg} />
      )}
      {post.kind === 'opportunity' ? (
        <View style={styles.opportunity}>
          <View style={styles.briefcase}>
            <Icon name="briefcase" size={20} color={c.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.display, fontSize: 22, color: c.ink }}>
              {post.opportunity.title}
            </Text>
            <Text style={type.meta}>
              {post.opportunity.closesOn
                ? `Closes ${shortDate(post.opportunity.closesOn)}`
                : 'Open'}
            </Text>
          </View>
          <Pressable
            onPress={() => Linking.openURL(post.opportunity.link)}
            accessibilityRole="link"
            style={styles.apply}
          >
            <Text style={{ color: '#fff', fontFamily: font.bold, fontSize: 14 }}>Apply</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={type.body}>{post.text}</Text>
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Rally count={post.likeCount} />
        <View style={styles.action}>
          <Icon name="comment" size={16} color={c.ink} />
          <Text style={styles.actionText}>{plural(post.commentCount, 'comment')}</Text>
        </View>
      </View>
    </Card>
  );
}

/**
 * "/home": posts from your communities, team first, then your other communities, then Team
 * Impact. Medical communities' posts stay in their own feed. Parents and recruiters don't post,
 * so they get no compose button (F5).
 */
export default function Home() {
  const { role, me } = useRole();
  const [filter, setFilter] = useState<Filter>('all');
  const feed = useApi(() => api.feed());
  const communities = useApi(() => api.communities());
  const canPost = role !== 'parent' && role !== 'recruiter';

  const keep = (p: Post) =>
    filter === 'all' ||
    (filter === 'team' ? p.community.kind === 'team' : p.community.kind !== 'team');

  return (
    <Screen
      eyebrow="Team IMPACT"
      title="Home"
      right={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton
            icon="bell"
            label="Notifications"
            dot
            onPress={() => router.push('/home/notifications')}
          />
          {me && (
            <Pressable
              onPress={() => router.push('/me')}
              accessibilityRole="button"
              accessibilityLabel="Your profile"
            >
              <Avatar firstName={me.firstName} lastName={me.lastName} role={me.role} size={44} />
            </Pressable>
          )}
        </View>
      }
      floating={
        canPost && (
          <Pressable
            onPress={() => router.push('/home/compose')}
            accessibilityRole="button"
            accessibilityLabel="New post"
            style={styles.fab}
          >
            <Icon name="plus" size={26} color="#fff" strokeWidth={2.4} />
          </Pressable>
        )
      }
    >
      {communities.state.status === 'ready' && role !== 'recruiter' && (
        <CommunityBubbles communities={communities.state.data} />
      )}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20 }}>
        <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="My team" selected={filter === 'team'} onPress={() => setFilter('team')} />
        <Chip
          label="Communities"
          selected={filter === 'communities'}
          onPress={() => setFilter('communities')}
        />
      </View>
      <Gutter>
        <Async state={feed.state}>
          {(page) => {
            const posts = page.items.filter(keep);
            return posts.length ? (
              posts.map((p) => <PostCard key={p.id} post={p} />)
            ) : (
              <View style={styles.empty}>
                <Text style={[type.display, { fontSize: 28 }]}>NOTHING HERE YET</Text>
                <Text style={[type.small, { textAlign: 'center' }]}>
                  Posts from your team and the communities you join show up here.
                </Text>
              </View>
            );
          }}
        </Async>
      </Gutter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bubble: { width: 64, alignItems: 'center', gap: 6 },
  ring: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, padding: 3 },
  bubbleFill: { flex: 1, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  bubbleText: { fontFamily: font.display, fontSize: 22 },
  bubbleLabel: { fontFamily: font.semibold, fontSize: 12, color: c.ink },
  announcement: { backgroundColor: c.navy, borderRadius: 20, padding: 18, gap: 12 },
  megaphone: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: c.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  announcementText: { fontFamily: font.displayBold, fontSize: 26, lineHeight: 27, color: '#fff' },
  company: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: c.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opportunity: {
    borderRadius: 14,
    backgroundColor: c.ground,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  briefcase: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apply: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: c.red,
    justifyContent: 'center',
  },
  action: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: { fontFamily: font.semibold, fontSize: 14, color: c.ink },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: c.red,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(208, 33, 60, 0.35)',
  },
  empty: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: c.line,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
});
