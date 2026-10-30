import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ResumeExtraction, UpdateCardRequest } from '@team-impact/contracts';
import { colors, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { entryText, FIELD_LABEL, fieldText } from '@/components/cardData';
import { SwitchRow } from '@/components/SwitchRow';
import { Async, ErrorText, Gutter, Screen, SectionLabel } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { Badge, Button, Card, Icon, Text } from '@/ui';

/** Switch key for one proposed experience entry. */
const entryKey = (i: number) => `experience.${i}`;

/** What to tell the athlete when the reader got nothing out of the file. */
const FAILED_BECAUSE: Record<NonNullable<ResumeExtraction['failReason']>, string> = {
  unreadable: 'The file looks damaged or password-protected.',
  no_text: 'It looks like a scan, and we can’t read scans yet.',
  ocr_unavailable: 'We can’t read photos yet.',
  ocr_failed: 'Reading photos isn’t working right now.',
  nothing_found: 'We didn’t find any card fields in it.',
};

/**
 * Every field the reader found, shown as plain text (never markup or links: it's untrusted), each
 * with its own accept switch. Fields the reader is unsure of are flagged "Check" and start off,
 * like experience entries, so the athlete has to look before accepting. Only accepted fields and
 * entries go into the card's draft.
 */
function Review({ extraction }: { extraction: ResumeExtraction }) {
  const entries = extraction.fields.experience ?? [];
  const fieldKeys = extraction.needsReview.filter((k) => k !== 'experience');
  const [accepted, setAccepted] = useState<Set<string>>(
    () => new Set(fieldKeys.filter((k) => !extraction.check.includes(k))),
  );
  const [error, setError] = useState<string | null>(null);
  const acceptedEntries = entries.filter((_, i) => accepted.has(entryKey(i)));

  const confirm = () => {
    const fields = Object.fromEntries(
      fieldKeys.filter((k) => accepted.has(k)).map((k) => [k, extraction.fields[k]]),
    ) as UpdateCardRequest;
    if (acceptedEntries.length > 0) fields.experience = acceptedEntries;
    api.confirmResume({ draftId: extraction.id, fields }).then(
      () => router.replace('/card/editor'),
      (e: Error) => setError(e.message),
    );
  };
  const toggle = (k: string) => (on: boolean) =>
    setAccepted((s) => {
      const next = new Set(s);
      if (on) next.add(k);
      else next.delete(k);
      return next;
    });
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
            {extraction.failReason ? `${FAILED_BECAUSE[extraction.failReason]} ` : ''}Type your card
            in yourself. It only takes a few minutes.
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
      {(extraction.check.length > 0 || extraction.checkEntries.length > 0) && (
        <Text variant="small" color="secondary">
          We’re less sure of anything marked Check, so it starts off. Turn it on only if it’s right;
          you can fix it on the next screen.
        </Text>
      )}
      {fieldKeys.length > 0 && (
        <Card>
          {fieldKeys.map((k) => (
            <SwitchRow
              key={k}
              label={FIELD_LABEL[k]}
              detail={fieldText(extraction.fields[k])}
              flag={extraction.check.includes(k) ? 'Check' : undefined}
              value={accepted.has(k)}
              onChange={toggle(k)}
            />
          ))}
        </Card>
      )}
      {entries.length > 0 && (
        <>
          <SectionLabel>{FIELD_LABEL.experience}</SectionLabel>
          <Text variant="small" color="secondary">
            Accept each entry you want on your card. Accepted entries replace the experience on your
            card; you can edit or reorder them next.
          </Text>
          <Card>
            {entries.map((e, i) => (
              <SwitchRow
                key={entryKey(i)}
                label={e.role}
                detail={entryText({ ...e, role: '' })}
                flag={extraction.checkEntries.includes(i) ? 'Check' : undefined}
                value={accepted.has(entryKey(i))}
                onChange={toggle(entryKey(i))}
              />
            ))}
          </Card>
        </>
      )}
      {error && <ErrorText>{error}</ErrorText>}
      <View style={styles.actions}>
        <Button label="Discard" variant="secondary" stretch onPress={discard} />
        <Button
          label={`Use ${accepted.size} item${accepted.size === 1 ? '' : 's'}`}
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
