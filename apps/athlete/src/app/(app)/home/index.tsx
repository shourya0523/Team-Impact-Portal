import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { Community, Post } from '@team-impact/contracts';
import { colors, layout, radius, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { ROLE_LABEL, shortDate } from '@/components/format';
import { ReportButton } from '@/components/Report';
import { Async, Chip, Gutter, IconButton, Screen } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { KIND_STYLE, monogram } from '@/theme';
import { Avatar, Badge, Card, Icon, Text, withAlpha } from '@/ui';

const BUBBLE = 64;
const LOCK = 22;
const FAB = 60;
const TILE = 40;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

type Filter = 'all' | 'team' | 'communities';

const isPrivate = (x: Community) =>
  x.kind === 'team' || ((x.kind === 'interest' || x.kind === 'medical') && x.private);

/**
 * A row of shortcuts to the communities you're in, medical ones included (PRD v2.3): only you see
 * this row, so it shows your own memberships. Private communities carry a small lock.
 */
function CommunityBubbles({ communities }: { communities: Community[] }) {
  const shown = communities.filter((x) => x.myMembership);
  const open = (id: string) => router.push({ pathname: '/me/communities/[id]', params: { id } });
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.bubbles}
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
            <View style={[styles.ring, { borderColor: colors.action }]}>
              <View style={[styles.bubbleFill, { backgroundColor: k.band }]}>
                <Text variant="display" size="xs" color={k.onBand} accessibilityRole="none">
                  {x.kind === 'team_impact' ? 'TI' : monogram(x.name, x.kind === 'team')}
                </Text>
              </View>
              {isPrivate(x) && (
                <View style={styles.lockBadge}>
                  <Icon name="lock" size={11} color={colors.brand} strokeWidth={2.8} />
                </View>
              )}
            </View>
            <Text variant="caption" weight="semibold" numberOfLines={1}>
              {x.kind === 'team_impact' ? 'Team Impact' : label}
            </Text>
          </Pressable>
        );
      })}
      <Pressable
        onPress={() => router.push('/me/communities')}
        accessibilityRole="button"
        style={styles.bubble}
      >
        <View style={[styles.ring, styles.more]}>
          <Icon name="plus" size={24} color={colors.text.secondary} />
        </View>
        <Text variant="caption" weight="semibold">
          Find more
        </Text>
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
      style={[styles.action, on ? styles.rallied : null]}
    >
      <Icon
        name="heart"
        size={16}
        color={on ? colors.actionPressed : colors.ink}
        fill={on ? colors.actionPressed : 'none'}
      />
      <Text variant="small" weight="semibold" color={on ? 'action' : 'ink'}>
        Rally · {count + (on ? 1 : 0)}
      </Text>
    </Pressable>
  );
}

function Announcement({ post }: { post: Post }) {
  return (
    <View style={styles.announcement}>
      <View style={styles.byline}>
        <View style={styles.megaphone}>
          <Icon name="megaphone" size={18} color={colors.onBrand.text} />
        </View>
        <View>
          <Text weight="semibold" color="onBrand">
            Team IMPACT
          </Text>
          <Text variant="caption" weight="medium" color="onBrandSecondary">
            Announcement · {shortDate(post.createdAt)}
          </Text>
        </View>
      </View>
      <Text
        variant="display"
        size="xs"
        color="onBrand"
        accessibilityRole="none"
        style={styles.mixedCase}
      >
        {post.text}
      </Text>
      <View style={styles.actions}>
        <Rally count={post.likeCount} />
      </View>
    </View>
  );
}

function PostCard({ post, onChanged }: { post: Post; onChanged?: () => void }) {
  const { me } = useRole();
  if (post.kind === 'announcement') return <Announcement post={post} />;
  const where =
    post.community.kind === 'team'
      ? `Team only · ${post.community.name}`
      : `in ${post.community.name}`;
  return (
    <Card>
      <View style={styles.byline}>
        {post.kind === 'opportunity' ? (
          <View style={styles.company}>
            <Text variant="small" weight="semibold" color="onBrand">
              {monogram(post.opportunity.company.name)}
            </Text>
          </View>
        ) : (
          <Avatar
            name={`${post.author.firstName} ${post.author.lastName}`}
            role={post.author.role}
          />
        )}
        <View style={styles.bylineText}>
          <View style={styles.nameRow}>
            <Text weight="semibold">
              {post.kind === 'opportunity'
                ? post.opportunity.company.name
                : `${post.author.firstName} ${post.author.lastName}`}
            </Text>
            {post.kind === 'post' && post.author.role !== 'athlete' && (
              <Badge label={ROLE_LABEL[post.author.role]} variant="brandTint" caps />
            )}
          </View>
          <View style={styles.meta}>
            {post.community.kind === 'team' && (
              <Icon name="lock" size={12} color={colors.text.muted} strokeWidth={2.4} />
            )}
            <Text variant="caption" weight="medium" color="muted" numberOfLines={1}>
              {post.kind === 'opportunity' ? 'Opportunity · ' : ''}
              {where} · {shortDate(post.createdAt)}
            </Text>
          </View>
        </View>
        {me?.id !== post.author.id && (
          <ReportButton
            target={{ kind: 'post', id: post.id }}
            author={
              post.author.role === 'staff'
                ? undefined
                : { id: post.author.id, name: post.author.firstName }
            }
            onDone={onChanged}
          />
        )}
      </View>
      {post.moderation !== 'approved' && (
        <Badge label="Waiting for review" variant="warning" caps />
      )}
      {post.kind === 'opportunity' ? (
        <View style={styles.opportunity}>
          <View style={styles.briefcase}>
            <Icon name="briefcase" size={20} color={colors.role.recruiter} />
          </View>
          <View style={styles.grow}>
            <Text variant="display" size="xs" accessibilityRole="none">
              {post.opportunity.title}
            </Text>
            <Text variant="caption" weight="medium" color="muted">
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
            <Text variant="small" weight="semibold" color="onBrand">
              Apply
            </Text>
          </Pressable>
        </View>
      ) : (
        <Text>{post.text}</Text>
      )}
      <View style={styles.actions}>
        <Rally count={post.likeCount} />
        <View style={styles.action}>
          <Icon name="comment" size={16} color={colors.ink} />
          <Text variant="small" weight="semibold">
            {plural(post.commentCount, 'comment')}
          </Text>
        </View>
      </View>
    </Card>
  );
}

/**
 * "/home": posts from your communities, team first, then your other communities (medical and
 * private ones included), then Team Impact. Parents and recruiters don't post,
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
        <View style={styles.actions}>
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
              <Avatar name={`${me.firstName} ${me.lastName}`} role={me.role} />
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
            <Icon name="plus" size={26} color={colors.onBrand.text} strokeWidth={2.4} />
          </Pressable>
        )
      }
    >
      {communities.state.status === 'ready' && role !== 'recruiter' && (
        <CommunityBubbles communities={communities.state.data} />
      )}
      <View style={styles.chips}>
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
              posts.map((p) => <PostCard key={p.id} post={p} onChanged={feed.reload} />)
            ) : (
              <View style={styles.empty}>
                <Text variant="display" size="xs" color="brand">
                  Nothing here yet
                </Text>
                <Text variant="small" color="secondary" style={styles.center}>
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
  bubbles: { paddingHorizontal: spacing.md, gap: spacing.md },
  bubble: { width: BUBBLE, alignItems: 'center', gap: spacing.xs },
  ring: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    borderWidth: 3,
    padding: spacing.xs,
  },
  more: {
    borderStyle: 'dashed',
    borderColor: colors.text.muted,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleFill: {
    flex: 1,
    borderRadius: BUBBLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: LOCK,
    height: LOCK,
    borderRadius: LOCK / 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md },
  byline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bylineText: { flex: 1, gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
  center: { textAlign: 'center' },
  // Announcements are sentences: condensed display face, but not shouted in caps.
  mixedCase: { textTransform: 'none' },
  announcement: {
    backgroundColor: colors.brand,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.md,
  },
  megaphone: {
    width: TILE,
    height: TILE,
    borderRadius: radius.sm,
    backgroundColor: colors.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
  company: {
    width: TILE,
    height: TILE,
    borderRadius: radius.sm,
    backgroundColor: colors.role.recruiter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opportunity: {
    borderRadius: radius.lg,
    backgroundColor: colors.ground,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  briefcase: {
    width: TILE,
    height: TILE,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apply: {
    minHeight: layout.buttonHeight.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.action,
    justifyContent: 'center',
  },
  action: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rallied: { backgroundColor: colors.actionTint, borderColor: colors.actionTint },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    width: FAB,
    height: FAB,
    borderRadius: radius.xl,
    backgroundColor: colors.action,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: [
      {
        offsetX: 0,
        offsetY: spacing.sm,
        blurRadius: spacing.lg,
        color: withAlpha(colors.action, 0.35),
      },
    ],
  },
  empty: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
});
