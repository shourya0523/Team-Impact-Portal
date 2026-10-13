import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  REPORT_REASONS,
  type CreateReportRequest,
  type ReportReason,
} from '@team-impact/contracts';
import { colors, layout, radius, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { ErrorText, IconButton } from '@/components/ui';
import { Button, Input, Sheet, Text } from '@/ui';

export const REASON_LABEL: Record<ReportReason, string> = {
  bullying: 'Bullying or harassment',
  inappropriate_for_kids: 'Not OK around kids',
  private_information: 'Shares private information',
  impersonation: 'Pretending to be someone',
  spam: 'Spam or scam',
  other: 'Something else',
};

const WHAT: Record<CreateReportRequest['target']['kind'], string> = {
  post: 'post',
  comment: 'comment',
  event: 'event',
  profile: 'profile',
  community: 'community',
};

const DOT = 20;

type ReportProps = {
  target: CreateReportRequest['target'];
  /** Offer blocking the item's author from the same form (P2). Never Team Impact staff. */
  author?: { id: string; name: string };
  /** After a report or block, e.g. to reload a feed the item should drop out of. */
  onDone?: () => void;
};

/**
 * The report form (PRD §9, P5): pick a reason, add an optional note, send. Team Impact staff get
 * a ticket; the item is hidden for you at once and its author never learns who reported it.
 * `onDone` runs as soon as the report or block goes through; `onClose` is the confirmation's
 * Close button.
 */
export function ReportForm({
  target,
  author,
  onDone,
  onClose,
}: ReportProps & { onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError(null);
    action()
      .then(() => {
        setDone(message);
        onDone?.();
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  const send = () =>
    reason &&
    run(
      () => api.report({ target, reason, ...(note.trim() ? { note: note.trim() } : {}) }),
      `Thanks. Team Impact will review this ${WHAT[target.kind]}, and we’ve hidden it for you.`,
    );

  const block = () =>
    author &&
    run(
      () => api.block(author.id),
      `${author.name} is blocked. You won’t see each other’s posts, comments or events. Undo this in Me › Safety.`,
    );

  if (done) {
    return (
      <>
        <Text color="secondary" accessibilityRole="alert">
          {done}
        </Text>
        <Button label="Close" onPress={onClose} />
      </>
    );
  }
  return (
    <>
      <Text variant="small" color="secondary">
        Reports are private. The person you report never learns who sent it.
      </Text>
      <View accessibilityRole="radiogroup" style={styles.reasons}>
        {REPORT_REASONS.map((r) => {
          const on = reason === r;
          return (
            <Pressable
              key={r}
              onPress={() => setReason(r)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={[styles.reason, on && styles.reasonOn]}
            >
              <View style={[styles.dot, on && styles.dotOn]} />
              <Text weight={on ? 'semibold' : 'regular'} color={on ? 'brand' : 'ink'}>
                {REASON_LABEL[r]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Input
        label="Anything staff should know? (optional)"
        value={note}
        onChangeText={setNote}
        maxLength={500}
        multiline
      />
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Send report" disabled={!reason || busy} onPress={send} />
      {author && (
        <Button
          label={`Block ${author.name}`}
          variant="secondary"
          disabled={busy}
          onPress={block}
        />
      )}
    </>
  );
}

/**
 * The report form in a bottom sheet. It remounts on open, so each report starts fresh. `onDone`
 * runs once the sheet closes, so a feed reload can't pull the sheet away mid-confirmation.
 */
export function ReportSheet({
  visible,
  onClose,
  onDone,
  ...props
}: ReportProps & { visible: boolean; onClose: () => void }) {
  const [acted, setActed] = useState(false);
  const close = () => {
    onClose();
    if (acted) onDone?.();
    setActed(false);
  };
  return (
    <Sheet visible={visible} title={`Report this ${WHAT[props.target.kind]}`} onClose={close}>
      {visible && <ReportForm {...props} onDone={() => setActed(true)} onClose={close} />}
    </Sheet>
  );
}

/** A flag button that opens the report sheet. Drop it next to any post, event, profile or community. */
export function ReportButton(props: ReportProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton
        icon="flag"
        label={`Report this ${WHAT[props.target.kind]}`}
        onPress={() => setOpen(true)}
      />
      <ReportSheet {...props} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  reasons: { gap: spacing.xs },
  reason: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  reasonOn: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: colors.text.muted,
  },
  dotOn: { borderColor: colors.brand, backgroundColor: colors.brand },
});
