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

/**
 * The report sheet (PRD §9, P5): pick a reason, add an optional note, send. Team Impact staff get
 * a ticket; the item is hidden for you at once and its author never learns who reported it.
 * Pass `author` to offer blocking them from the same sheet (P2).
 */
export function ReportSheet({
  target,
  author,
  visible,
  onClose,
  onDone,
}: {
  target: CreateReportRequest['target'];
  author?: { id: string; name: string };
  visible: boolean;
  onClose: () => void;
  /** After a report or block, e.g. to reload a feed the item should drop out of. */
  onDone?: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (done) onDone?.();
    setReason(null);
    setNote('');
    setDone(null);
    setError(null);
    onClose();
  };

  const run = (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError(null);
    action()
      .then(() => setDone(message))
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

  return (
    <Sheet
      visible={visible}
      title={done ? 'Done' : `Report this ${WHAT[target.kind]}`}
      onClose={close}
    >
      {done ? (
        <>
          <Text color="secondary">{done}</Text>
          <Button label="Close" onPress={close} />
        </>
      ) : (
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
      )}
    </Sheet>
  );
}

/** A flag button that opens the report sheet. Drop it next to any post, event, profile or community. */
export function ReportButton(
  props: Omit<Parameters<typeof ReportSheet>[0], 'visible' | 'onClose'>,
) {
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
