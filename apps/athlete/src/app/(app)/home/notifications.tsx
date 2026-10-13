import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import type { Notification, NotificationKind } from '@team-impact/contracts';
import { colors, radius, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { shortDate } from '@/components/format';
import { Async, Gutter, Screen } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { Button, Card, Icon, Text, type IconName } from '@/ui';

const TILE = 40;
const DOT = 10;

const ICON: Record<NotificationKind, IconName> = {
  join_approved: 'check',
  reply: 'comment',
  event: 'calendar',
  announcement: 'megaphone',
  warning: 'flag',
};

const open = (n: Notification) => {
  if (n.target.kind === 'post') {
    router.push({ pathname: '/home/posts/[id]', params: { id: n.target.id } });
  } else if (n.target.kind === 'event') {
    router.push({ pathname: '/events/[id]', params: { id: n.target.id } });
  } else {
    router.push({ pathname: '/me/communities/[id]', params: { id: n.target.id } });
  }
};

/**
 * "/home/notifications": join approvals, replies to your posts, events in your communities and
 * Team Impact announcements, newest first. Which kinds arrive follows your notification settings.
 */
export default function Notifications() {
  const { state, reload } = useApi(() => api.notifications());

  const tap = (n: Notification) => {
    if (!n.read) void api.markNotificationsRead([n.id]).then(reload);
    open(n);
  };

  return (
    <Screen
      eyebrow="Home"
      title="Notifications"
      back
      right={
        state.status === 'ready' && state.data.unreadCount > 0 ? (
          <Button
            label="Mark all read"
            variant="secondary"
            size="sm"
            onPress={() => void api.markNotificationsRead().then(reload)}
          />
        ) : undefined
      }
    >
      <Gutter>
        <Async state={state}>
          {(list) =>
            list.items.length ? (
              list.items.map((n) => (
                <Card key={n.id} onPress={() => tap(n)} label={n.text}>
                  <View style={styles.row}>
                    <View style={[styles.tile, n.kind === 'announcement' && styles.tileAction]}>
                      <Icon
                        name={ICON[n.kind]}
                        size={18}
                        color={n.kind === 'announcement' ? colors.onBrand.text : colors.brand}
                      />
                    </View>
                    <View style={styles.grow}>
                      <Text weight={n.read ? 'regular' : 'semibold'} numberOfLines={3}>
                        {n.text}
                      </Text>
                      <Text variant="caption" weight="medium" color="muted">
                        {shortDate(n.createdAt)}
                      </Text>
                    </View>
                    {!n.read && <View style={styles.dot} accessibilityLabel="Unread" />}
                  </View>
                </Card>
              ))
            ) : (
              <View style={styles.empty}>
                <Text variant="display" size="xs" color="brand">
                  All caught up
                </Text>
                <Text variant="small" color="secondary" style={styles.center}>
                  Replies, approvals, events and announcements show up here.
                </Text>
              </View>
            )
          }
        </Async>
        <Button
          label="Notification settings"
          variant="secondary"
          onPress={() => router.push('/me/safety')}
        />
      </Gutter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1, gap: spacing.xs },
  center: { textAlign: 'center' },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileAction: { backgroundColor: colors.action },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: colors.action },
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
