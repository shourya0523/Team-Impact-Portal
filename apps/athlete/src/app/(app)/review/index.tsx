import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CardFace } from '@team-impact/contracts';
import { CARD_ASPECT, cardHeightFor } from '@team-impact/ui-primitives/native';
import { colors, layout, radius, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { SwipeCard, type Swipe, type SwipeCardHandle } from '@/components/recruiter-deck';
import {
  ListPickerSheet,
  SavedFlash,
  SaveListChip,
  type Landed,
} from '@/components/recruiter-parts';
import {
  filterLabels,
  saveToTarget,
  targetName,
  toSearchQuery,
  useReviewState,
} from '@/components/recruiter-state';
import { Async, Chip, Gutter, Screen } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { Badge, Button, haptics, Text } from '@/ui';

const MAX_CARD_WIDTH = 340;
/** Height of everything on the screen but the card: header, filters, buttons, tab bar. */
const CHROME = 460;

/**
 * "/review": quick review (PRD §7, R7, A-49). Cards that match the recruiter's filters, one at a
 * time. Swipe right or Save puts the athlete on the save list ("Saved" unless the recruiter picks
 * another); swipe left or Skip moves on and records nothing.
 */
export default function QuickReview() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { filters, target } = useReviewState();
  const key = JSON.stringify(filters);
  const { state, reload } = useApi(() => api.searchAthletes(toSearchQuery(filters)), [key]);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  // "Deal to list": each landed save bumps the list chip and flashes the Save button.
  const [landed, setLanded] = useState<Landed | null>(null);
  const [flash, setFlash] = useState(0);
  const top = useRef<SwipeCardHandle>(null);

  // New filters, new deck.
  useEffect(() => {
    setIndex(0);
    setStatus(null);
  }, [key]);

  const cardWidth = Math.max(
    0,
    Math.min(
      width - spacing.xl * 2,
      MAX_CARD_WIDTH,
      (height - CHROME - insets.top - insets.bottom) / CARD_ASPECT,
    ),
  );
  const listName = targetName(target);
  const labels = filterLabels(filters);

  // A different list, a different count.
  useEffect(() => setLanded(null), [target?.id]);

  const decide = (card: CardFace, dir: Swipe) => {
    setIndex((i) => i + 1);
    if (dir < 0) {
      setStatus(`Skipped ${card.firstName}`);
      return;
    }
    setStatus(`Saving ${card.firstName}…`);
    saveToTarget(card.athleteId).then(
      (r) => {
        haptics.success();
        setFlash((n) => n + 1);
        setLanded((prev) => ({
          seq: (prev?.seq ?? 0) + 1,
          listId: r.listId,
          // Quick saves can overlap; never let a slower answer count backwards.
          count:
            prev?.listId === r.listId
              ? Math.max(r.count, prev.count + (r.already ? 0 : 1))
              : r.count,
        }));
        setStatus(
          r.already
            ? `${card.firstName} is already in ${r.list}`
            : `Saved ${card.firstName} to ${r.list}`,
        );
      },
      (e: Error) => {
        haptics.error();
        setStatus(`Couldn’t save ${card.firstName}: ${e.message}`);
      },
    );
  };

  return (
    <Screen eyebrow="Recruiter" title="Quick review">
      <Gutter gap="sm">
        <View style={styles.row}>
          {labels.length ? (
            labels.map((l) => <Badge key={l} variant="brandTint" label={l} />)
          ) : (
            <Badge variant="brandTint" label="All athletes" />
          )}
          <Chip
            label="Edit filters"
            selected={false}
            onPress={() => router.push('/review/filters')}
          />
        </View>
        <View style={styles.row}>
          <Text variant="small" color="secondary">
            Swipe right saves to
          </Text>
          <SaveListChip landed={landed} onPress={() => setPicking(true)} />
        </View>
      </Gutter>

      <Async state={state}>
        {(page) => {
          const deck = page.items;
          const card = deck[index];
          const next = deck[index + 1];
          if (!card) {
            return (
              <Gutter>
                <View style={[styles.empty, { minHeight: cardHeightFor(cardWidth) }]}>
                  <Text variant="display" size="md" color="brand" style={styles.center}>
                    {deck.length ? 'All caught up' : 'No matches'}
                  </Text>
                  <Text color="secondary" style={styles.center}>
                    {deck.length
                      ? `You’ve seen everyone who matches. Athletes you saved are in ${listName}.`
                      : 'Nobody who is open to recruiting matches these filters yet.'}
                  </Text>
                  {deck.length ? (
                    <View style={styles.actions}>
                      <Button
                        label="Review again"
                        variant="secondary"
                        size="sm"
                        onPress={() => {
                          setIndex(0);
                          reload();
                        }}
                      />
                      <Button
                        label="Open lists"
                        variant="brand"
                        size="sm"
                        onPress={() => router.navigate('/lists')}
                      />
                    </View>
                  ) : (
                    <Button
                      label="Edit filters"
                      variant="secondary"
                      size="sm"
                      onPress={() => router.push('/review/filters')}
                    />
                  )}
                </View>
                {status && (
                  <Text variant="small" color="secondary" accessibilityLiveRegion="polite">
                    {status}
                  </Text>
                )}
              </Gutter>
            );
          }
          return (
            <Gutter>
              <Text
                variant="small"
                weight="semibold"
                color="secondary"
                style={styles.center}
                accessibilityLiveRegion="polite"
              >
                {index + 1} of {deck.length}
              </Text>
              <View style={[styles.deck, { height: cardHeightFor(cardWidth) }]}>
                {next && (
                  <View
                    aria-hidden
                    style={[styles.peek, { width: cardWidth, height: cardHeightFor(cardWidth) }]}
                  />
                )}
                <SwipeCard
                  key={card.id}
                  ref={top}
                  card={card}
                  width={cardWidth}
                  saveTo={listName}
                  onDecide={(dir) => decide(card, dir)}
                />
              </View>
              <View style={styles.actions}>
                <Button
                  label="Skip"
                  variant="secondary"
                  stretch
                  accessibilityHint="Moves to the next athlete. Nothing is recorded."
                  onPress={() => top.current?.fling(-1)}
                />
                <Button
                  label="Card"
                  icon="card"
                  variant="secondary"
                  stretch
                  accessibilityLabel={`Open ${card.firstName}’s full card and contacts`}
                  onPress={() => router.push(`/review/athletes/${card.athleteId}`)}
                />
                <SavedFlash flash={flash} stretch>
                  <Button
                    label="Save"
                    stretch
                    icon="heart"
                    accessibilityLabel={`Save ${card.firstName} to ${listName}`}
                    onPress={() => top.current?.fling(1)}
                  />
                </SavedFlash>
              </View>
              <Text
                variant="small"
                color="secondary"
                style={styles.center}
                accessibilityLiveRegion="polite"
              >
                {status ?? 'Drag the card, or use the buttons.'}
              </Text>
            </Gutter>
          );
        }}
      </Async>

      <ListPickerSheet
        visible={picking}
        onClose={() => setPicking(false)}
        onNew={() => {
          setPicking(false);
          router.push({ pathname: '/lists/new', params: { pick: '1' } });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  deck: { alignItems: 'center', justifyContent: 'flex-start' },
  peek: {
    position: 'absolute',
    top: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: colors.brand,
    opacity: 0.3,
    transform: [{ scale: 0.95 }],
  },
  actions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.line,
    minWidth: layout.minTouchTarget,
  },
  center: { textAlign: 'center' },
});
