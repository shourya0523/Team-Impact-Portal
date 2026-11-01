import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { Community, FeedScope } from '@team-impact/contracts';
import { colors, radius, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { PostCard } from '@/components/post-card';
import { FeedSkeleton } from '@/components/post-skeleton';
import {
  Async,
  Chip,
  EmptyState,
  Gutter,
  IconButton,
  PageFooter,
  ScreenList,
} from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { usePaged } from '@/hooks/usePaged';
import { useRole } from '@/navigation/role';
import { KIND_STYLE, monogram } from '@/theme';
import { Avatar, Icon, Text, withAlpha } from '@/ui';

const BUBBLE = 64;
const LOCK = 22;
const FAB = 60;
/** What each chip says when it has no posts; `find` offers a way to join communities. */
const EMPTY: Record<FeedScope, { title: string; body: string; find: boolean }> = {
  all: {
    title: 'Nothing here yet',
    body: 'Posts from your team and the communities you join show up here.',
    find: true,
  },
  team: {
    title: 'Nothing from your team yet',
    body: 'When your team posts, it shows up here.',
    find: false,
  },
  communities: {
    title: 'No community posts yet',
    body: 'Posts from communities you join show up here.',
    find: true,
  },
};
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

/**
 * "/home": posts from your communities, team first, then your other communities (medical and
 * private ones included), then Team Impact. Parents and recruiters don't post,
 * so they get no compose button (F5).
 */
export default function Home() {
  const { role, me } = useRole();
  const [filter, setFilter] = useState<FeedScope>('all');
  // A new list from page 1 per chip: the server filters, so every page is full (step 3a, `scope`).
  const feed = usePaged((cursor) => api.feed(cursor, filter), [filter]);
  const communities = useApi(() => api.communities());
  const canPost = role !== 'parent' && role !== 'recruiter';

  return (
    <ScreenList
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
      top={
        <>
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
        </>
      }
      data={feed.state.status === 'ready' ? feed.state.data : []}
      renderItem={(p) => <PostCard post={p} onRemove={feed.remove} />}
      onEndReached={feed.loadMore}
      refreshing={feed.refreshing}
      onRefresh={feed.refresh}
      empty={
        <Async state={feed.state} loading={<FeedSkeleton />} onRetry={feed.refresh}>
          {() => (
            <Gutter>
              <EmptyState
                title={EMPTY[filter].title}
                action={
                  EMPTY[filter].find && role !== 'recruiter'
                    ? { label: 'Find communities', onPress: () => router.push('/me/communities') }
                    : undefined
                }
              >
                {EMPTY[filter].body}
              </EmptyState>
            </Gutter>
          )}
        </Async>
      }
      footer={<PageFooter loading={feed.loadingMore} failure={feed.failure} onRetry={feed.retry} />}
    />
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
  actions: { flexDirection: 'row', gap: spacing.sm },
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
});
