import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { AthleteCard } from '@team-impact/ui-primitives/native';
import { colors, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { toCardData } from '@/components/cardData';
import { Async, ErrorText, Gutter, Screen, SectionLabel } from '@/components/ui';
import { shortDate } from '@/components/format';
import { useApi } from '@/hooks/useApi';
import { Badge, Button, Card, Icon, Text, type IconName } from '@/ui';

/** Widest the card gets on tablets and web. */
const MAX_CARD_WIDTH = 360;

function Row({
  icon,
  label,
  detail,
  href,
}: {
  icon: IconName;
  label: string;
  detail: string;
  href: Href;
}) {
  return (
    <Card onPress={() => router.push(href)} label={label} style={styles.row}>
      <Icon name={icon} size={20} color={colors.brand} />
      <View style={styles.grow}>
        <Text weight="semibold">{label}</Text>
        <Text variant="small" color="secondary">
          {detail}
        </Text>
      </View>
      <Icon name="chevron" size={18} color={colors.text.muted} />
    </Card>
  );
}

/**
 * "/card": the athlete's Baseball Card. Start screen (upload or build by hand) before the first
 * publish; afterwards the card itself, its status and what to do next.
 */
export default function CardHome() {
  const { width } = useWindowDimensions();
  const { state, reload } = useApi(() => api.myCard());
  const [error, setError] = useState<string | null>(null);
  const cardWidth = Math.min(width - spacing.md * 2, MAX_CARD_WIDTH);

  const publish = () =>
    api.publishCard().then(
      () => {
        setError(null);
        reload();
      },
      (e: Error) => setError(e.message),
    );

  return (
    <Screen eyebrow="Baseball Card" title="My card">
      <Async state={state}>
        {({ card, draft, pendingResume }) => (
          <Gutter>
            {pendingResume && (
              <Card
                onPress={() => router.push('/card/review')}
                label="Review what we read from your resume"
                style={[styles.row, styles.tint]}
              >
                <Icon name="check" size={20} color={colors.brand} />
                <View style={styles.grow}>
                  <Text weight="semibold" color="brand">
                    Review your resume
                  </Text>
                  <Text variant="small" color="brand">
                    Nothing from it shows on your card until you check and confirm it.
                  </Text>
                </View>
              </Card>
            )}

            {card ? (
              <>
                <View style={styles.badges}>
                  <Badge
                    caps
                    variant={card.visibility.published ? 'success' : 'warning'}
                    label={card.visibility.published ? 'Published' : 'Not published'}
                  />
                  {card.visibility.openToRecruiting && (
                    <Badge caps variant="brandTint" icon="briefcase" label="Open to recruiting" />
                  )}
                  <Badge label={`Season ${card.season} · updated ${shortDate(card.updatedAt)}`} />
                </View>
                <View style={styles.cardWrap}>
                  <AthleteCard athlete={toCardData(card, card.contact)} width={cardWidth} />
                </View>
                <Text variant="small" color="secondary" style={styles.center}>
                  Tap or swipe the card to see the back.
                </Text>
              </>
            ) : (
              <Card>
                <Text variant="display" size="sm" color="brand">
                  Build your card
                </Text>
                <Text color="secondary">
                  Your Baseball Card is your resume here. Upload one and we’ll fill in what we can,
                  or type it in yourself. You check everything before anyone sees it.
                </Text>
                <Button
                  label="Upload resume"
                  icon="plus"
                  onPress={() => router.push('/card/upload')}
                />
                <Button
                  label="Fill it in myself"
                  variant="secondary"
                  onPress={() => router.push('/card/editor')}
                />
              </Card>
            )}

            {draft && (
              <Card>
                <Text weight="semibold">You have unpublished changes</Text>
                <Text variant="small" color="secondary">
                  Only you see them. Publishing updates the card your team
                  {card?.visibility.openToRecruiting ? ' and recruiters' : ''} see.
                </Text>
                <View style={styles.actions}>
                  <Button
                    label="Keep editing"
                    variant="secondary"
                    size="sm"
                    stretch
                    onPress={() => router.push('/card/editor')}
                  />
                  <Button label="Publish" size="sm" stretch onPress={publish} />
                </View>
              </Card>
            )}
            {error && <ErrorText>{error}</ErrorText>}

            {card && (
              <>
                <SectionLabel>Your card</SectionLabel>
                <Row
                  icon="user"
                  label="Edit card"
                  detail="Change any field, then publish"
                  href="/card/editor"
                />
                <Row
                  icon="plus"
                  label="Upload a new resume"
                  detail="We read it; you confirm each field"
                  href="/card/upload"
                />
                <Row
                  icon="card"
                  label="Export as image"
                  detail="A PNG to share outside the app"
                  href="/card/export"
                />
                <Row
                  icon="calendar"
                  label="Earlier seasons"
                  detail="Every card you published"
                  href="/card/history"
                />
                <Row
                  icon="briefcase"
                  label="Contacts and recruiting"
                  detail="Who sees your details; open to recruiting"
                  href="/me/recruiting"
                />
              </>
            )}
          </Gutter>
        )}
      </Async>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tint: { backgroundColor: colors.brandTint, borderColor: colors.brandTint },
  grow: { flex: 1, gap: spacing.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  cardWrap: { alignItems: 'center', paddingVertical: spacing.sm },
  center: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
