import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ResumeExtraction, UpdateCardRequest } from '@team-impact/contracts';
import { colors, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { FIELD_LABEL, fieldText } from '@/components/cardData';
import { SwitchRow } from '@/components/SwitchRow';
import { Async, ErrorText, Gutter, Screen } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { Badge, Button, Card, Icon, Text } from '@/ui';

/**
 * Every field the reader found, shown as plain text (never markup or links: it's untrusted), each
 * with its own accept switch. Only accepted fields go into the card's draft.
 */
function Review({ extraction }: { extraction: ResumeExtraction }) {
  const [accepted, setAccepted] = useState<Set<string>>(() => new Set(extraction.needsReview));
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    const fields = Object.fromEntries(
      extraction.needsReview.filter((k) => accepted.has(k)).map((k) => [k, extraction.fields[k]]),
    ) as UpdateCardRequest;
    api.confirmResume({ draftId: extraction.id, fields }).then(
      () => router.replace('/card/editor'),
      (e: Error) => setError(e.message),
    );
  };
  const discard = () =>
    api.discardResume().then(
      () => router.replace('/card'),
      (e: Error) => setError(e.message),
    );

  if (extraction.failed) {
    return (
      <Gutter>
        <Card>
          <Text weight="semibold">We couldn’t read {extraction.fileName}</Text>
          <Text variant="small" color="secondary">
            Type your card in yourself. It only takes a few minutes.
          </Text>
          <Button
            label="Fill it in myself"
            onPress={() =>
              api.discardResume().then(
                () => router.replace('/card/editor'),
                (e: Error) => setError(e.message),
              )
            }
          />
          {error && <ErrorText>{error}</ErrorText>}
        </Card>
      </Gutter>
    );
  }

  return (
    <Gutter>
      <Card style={styles.note}>
        <Icon name="lock" size={18} color={colors.brand} />
        <Text variant="small" color="brand" style={styles.grow}>
          Check each field. Only what you accept goes into your card, and it stays private until you
          publish.
        </Text>
      </Card>
      <View style={styles.badges}>
        <Badge caps variant="warning" label="Unconfirmed" />
        <Badge label={extraction.fileName} />
      </View>
      <Card>
        {extraction.needsReview.map((k) => (
          <SwitchRow
            key={k}
            label={FIELD_LABEL[k]}
            detail={fieldText(extraction.fields[k])}
            value={accepted.has(k)}
            onChange={(on) =>
              setAccepted((s) => {
                const next = new Set(s);
                if (on) next.add(k);
                else next.delete(k);
                return next;
              })
            }
          />
        ))}
      </Card>
      {error && <ErrorText>{error}</ErrorText>}
      <View style={styles.actions}>
        <Button label="Discard" variant="secondary" stretch onPress={discard} />
        <Button
          label={`Use ${accepted.size} field${accepted.size === 1 ? '' : 's'}`}
          stretch
          disabled={accepted.size === 0}
          onPress={confirm}
        />
      </View>
      <Text variant="small" color="secondary">
        Next you can correct anything and add what’s missing before publishing.
      </Text>
    </Gutter>
  );
}

/** "/card/review": confirm what the reader found in the uploaded resume. */
export default function CardReview() {
  const { state } = useApi(() => api.myCard());
  return (
    <Screen eyebrow="Baseball Card" title="Check your resume" back>
      <Async state={state}>
        {({ pendingResume }) =>
          pendingResume ? (
            <Review extraction={pendingResume} />
          ) : (
            <Gutter>
              <Text color="secondary">Nothing waiting for review.</Text>
              <Button label="Upload a resume" onPress={() => router.replace('/card/upload')} />
            </Gutter>
          )
        }
      </Async>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.brandTint,
    borderColor: colors.brandTint,
  },
  grow: { flex: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
