import { router, useFocusEffect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import type { RecruiterList } from '@team-impact/contracts';
import { spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { shortDate } from '@/components/format';
import { count, ListDot } from '@/components/recruiter-parts';
import { DEFAULT_LIST_NAME, fullName, useReviewState } from '@/components/recruiter-state';
import { Async, Gutter, Screen } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { Badge, Button, Card, Text } from '@/ui';

/** Stripe across the top of a list card, in the list's colour. */
const STRIPE = spacing.xs + spacing.xs / 2;

/** "Shared with Priya, Tom" for your own lists; "From Priya" for a colleague's. */
const sharing = (l: RecruiterList, myId: string | undefined) =>
  l.owner.id !== myId
    ? `From ${fullName(l.owner)}`
    : l.sharedWith.length
      ? `Shared with ${l.sharedWith.map((u) => u.firstName).join(', ')}`
      : 'Just you';

/**
 * "/lists" (A-50, R6): the recruiter's lists and the ones colleagues at the same company shared
 * with them. Athletes are never told they're on a list.
 */
export default function RecruiterLists() {
  const { me } = useRole();
  const { target } = useReviewState();
  const { state, reload } = useApi(() => api.lists());
  // Saves happen on other screens; show fresh counts whenever the tab comes back.
  useFocusEffect(reload);

  const isTarget = (l: RecruiterList) =>
    target ? target.id === l.id : l.name.toLowerCase() === DEFAULT_LIST_NAME.toLowerCase();

  return (
    <Screen
      eyebrow="Recruiter"
      title="Lists"
      right={
        <Button label="New list" icon="plus" size="sm" onPress={() => router.push('/lists/new')} />
      }
    >
      <Async state={state}>
        {(lists) => (
          <Gutter>
            {lists.length === 0 && (
              <Card>
                <Text weight="semibold">No lists yet</Text>
                <Text color="secondary">
                  Swipe right in quick review and we’ll start a {DEFAULT_LIST_NAME} list for you, or
                  make one now.
                </Text>
              </Card>
            )}
            {lists.map((l) => (
              <Card
                key={l.id}
                onPress={() => router.push(`/lists/${l.id}`)}
                label={`${l.name}, ${count(l.athleteCount)}`}
                style={styles.card}
              >
                <View style={[styles.stripe, { backgroundColor: l.color }]} />
                <View style={styles.head}>
                  <ListDot color={l.color} />
                  <Text weight="semibold" style={styles.grow} numberOfLines={1}>
                    {l.name}
                  </Text>
                  <Text variant="small" color="secondary">
                    {count(l.athleteCount)}
                  </Text>
                </View>
                {l.note && (
                  <Text variant="small" color="secondary" numberOfLines={2}>
                    {l.note}
                  </Text>
                )}
                <View style={styles.meta}>
                  <Text variant="caption" color="secondary">
                    {sharing(l, me?.id)} · updated {shortDate(l.updatedAt)}
                  </Text>
                  {isTarget(l) && (
                    <Badge variant="brandTint" icon="heart" label="Swipes save here" />
                  )}
                </View>
              </Card>
            ))}
          </Gutter>
        )}
      </Async>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', paddingTop: spacing.md + STRIPE },
  stripe: { position: 'absolute', top: 0, left: 0, right: 0, height: STRIPE },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
});
