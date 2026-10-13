import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Community, Post } from '@team-impact/contracts';
import { colors, layout, radius, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { KIND_LABEL } from '@/components/format';
import { Chip } from '@/components/ui';
import { Icon, Text } from '@/ui';

/**
 * Rally, the platform's reaction. Optimistic: the count moves at once and settles on the API's
 * answer. Held posts can't be rallied, so the button is off for them.
 */
export function Rally({ post, onChange }: { post: Post; onChange?: (p: Post) => void }) {
  const [state, setState] = useState({ on: post.likedByMe, count: post.likeCount });
  const held = post.moderation !== 'approved';
  const toggle = () => {
    const on = !state.on;
    setState({ on, count: state.count + (on ? 1 : -1) });
    (on ? api.rally(post.id) : api.unrally(post.id)).then(
      (p) => {
        setState({ on: p.likedByMe, count: p.likeCount });
        onChange?.(p);
      },
      () => setState({ on: post.likedByMe, count: post.likeCount }),
    );
  };
  return (
    <Pressable
      onPress={toggle}
      disabled={held}
      accessibilityRole="button"
      accessibilityLabel={`Rally, ${state.count}`}
      accessibilityState={{ selected: state.on, disabled: held }}
      style={[styles.action, state.on ? styles.rallied : null, held && styles.disabled]}
    >
      <Icon
        name="heart"
        size={16}
        color={state.on ? colors.actionPressed : colors.ink}
        fill={state.on ? colors.actionPressed : 'none'}
      />
      <Text variant="small" weight="semibold" color={state.on ? 'action' : 'ink'}>
        Rally · {state.count}
      </Text>
    </Pressable>
  );
}

/** Pick one community from `options`; the label says where the post or event will be seen. */
export function CommunityPicker({
  options,
  value,
  onChange,
}: {
  options: Community[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  if (!options.length) {
    return (
      <Text variant="small" color="secondary">
        Join a community first, then you can share there.
      </Text>
    );
  }
  const chosen = options.find((x) => x.id === value);
  return (
    <View style={styles.picker}>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Community">
        {options.map((x) => (
          <Chip
            key={x.id}
            label={x.kind === 'team_impact' ? 'Team Impact' : x.name}
            selected={x.id === value}
            onPress={() => onChange(x.id)}
          />
        ))}
      </View>
      {chosen && (
        <View style={styles.where}>
          <Icon
            name={chosen.kind === 'team' || isPrivate(chosen) ? 'lock' : 'users'}
            size={14}
            color={colors.text.secondary}
          />
          <Text variant="caption" weight="medium" color="secondary">
            {seenBy(chosen)}
          </Text>
        </View>
      )}
    </View>
  );
}

const isPrivate = (x: Community) => (x.kind === 'interest' || x.kind === 'medical') && x.private;

/** Who will see what's shared in `x`. */
export const seenBy = (x: Community) => {
  if (x.kind === 'team') return 'Only your team and its families see this.';
  if (x.kind === 'team_impact') return 'Everyone on Team Impact sees this.';
  if (isPrivate(x))
    return `Only members of this private ${KIND_LABEL[x.kind].toLowerCase()} community see this.`;
  return `Members of ${x.name} see this.`;
};

/** "Waiting for review" banner for the author's own held post, comment or event. */
export function HeldNote({ what }: { what: string }) {
  return (
    <View style={styles.held} accessibilityRole="alert">
      <Icon name="shield" size={16} color={colors.warning.text} />
      <Text variant="small" weight="medium" color="warning" style={styles.grow}>
        Waiting for review. Only you can see this {what} until Team Impact checks it.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  disabled: { opacity: 0.4 },
  picker: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  where: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  held: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.warning.bg,
  },
  grow: { flex: 1 },
});
