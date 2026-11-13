import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import type { Post } from '@team-impact/contracts';
import { colors, layout, radius, spacing } from '@team-impact/ui-tokens';
import { Rally } from '@/components/activity';
import { ROLE_LABEL, shortDate } from '@/components/format';
import { blockable, ReportButton, type ReportAction } from '@/components/Report';
import { useRole } from '@/navigation/role';
import { monogram } from '@/theme';
import { Avatar, Badge, Card, Icon, Text } from '@/ui';

const TILE = 40;

/**
 * The posts a report or block takes out of a list: a report hides that one post for you, a block
 * everything its author wrote (the API hides both from then on, so a reload agrees).
 */
const removedBy =
  (post: Post, action: ReportAction) =>
  (p: Post): boolean =>
    action === 'block' ? p.author.id === post.author.id : p.id === post.id;

type Remove = (drop: (p: Post) => boolean) => void;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Opens the post with its comments. */
function CommentsButton({ post }: { post: Post }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/home/posts/[id]', params: { id: post.id } })}
      accessibilityRole="button"
      style={styles.action}
    >
      <Icon name="comment" size={16} color={colors.ink} />
      <Text variant="small" weight="semibold">
        {plural(post.commentCount, 'comment')}
      </Text>
    </Pressable>
  );
}

/** No Report button on Team Impact's official posts (`Post.official`, never blockable) or your own. */
const reportable = (post: Post, myId: string | undefined) =>
  !post.official && post.author.id !== myId;

/** From Team Impact, not the staff member who wrote it. */
function Announcement({ post, onRemove }: { post: Post; onRemove?: Remove }) {
  const { role, me } = useRole();
  return (
    <View style={styles.announcement}>
      <View style={styles.byline}>
        <View style={styles.megaphone}>
          <Icon name="megaphone" size={18} color={colors.onBrand.text} />
        </View>
        <View style={styles.grow}>
          <Text weight="semibold" color="onBrand">
            Team IMPACT
          </Text>
          <Text variant="caption" weight="medium" color="onBrandSecondary">
            Announcement · {shortDate(post.createdAt)}
          </Text>
        </View>
        {reportable(post, me?.id) && (
          <ReportButton
            target={{ kind: 'post', id: post.id }}
            onDone={(action) => onRemove?.(removedBy(post, action))}
          />
        )}
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
        {role !== 'recruiter' && <Rally post={post} />}
        {role !== 'recruiter' && <CommentsButton post={post} />}
      </View>
    </View>
  );
}

/**
 * One post as the home feed and community pages show it: author, where and when, report and
 * block, rally and comments. `showCommunity` is off on a community's own page, where naming the
 * community again is noise. After a report or block, `onRemove` gets which posts to drop from the
 * list, so it updates on the device instead of loading again.
 */
export function PostCard({
  post,
  showCommunity = true,
  onRemove,
}: {
  post: Post;
  showCommunity?: boolean;
  onRemove?: Remove;
}) {
  const { role, me } = useRole();
  if (post.kind === 'announcement') return <Announcement post={post} onRemove={onRemove} />;
  const where = !showCommunity
    ? null
    : post.community.kind === 'team'
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
            {where && post.community.kind === 'team' && (
              <Icon name="lock" size={12} color={colors.text.muted} strokeWidth={2.4} />
            )}
            <Text variant="caption" weight="medium" color="muted" numberOfLines={1}>
              {post.kind === 'opportunity' ? 'Opportunity · ' : ''}
              {where ? `${where} · ` : ''}
              {shortDate(post.createdAt)}
            </Text>
          </View>
        </View>
        {reportable(post, me?.id) && (
          <ReportButton
            target={{ kind: 'post', id: post.id }}
            author={blockable(post.author, post.community.kind)}
            onDone={(action) => onRemove?.(removedBy(post, action))}
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
        {/* Recruiters only read: the API refuses their Rally, and the post page sits under the Home
            tab, which they don't have. */}
        {role !== 'recruiter' && <Rally post={post} />}
        {role !== 'recruiter' && <CommentsButton post={post} />}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  byline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bylineText: { flex: 1, gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
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
});
