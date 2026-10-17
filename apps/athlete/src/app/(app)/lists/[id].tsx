import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { RecruiterListEntry } from '@team-impact/contracts';
import { colors, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { shortDate } from '@/components/format';
import { count, JerseyTile, ListDot } from '@/components/recruiter-parts';
import {
  DEFAULT_LIST_NAME,
  fullName,
  setSaveTarget,
  useReviewState,
} from '@/components/recruiter-state';
import { Async, ErrorText, Gutter, Screen } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { Button, Card, haptics, HoldButton, Icon, Input, Sheet, Text } from '@/ui';

/**
 * "/lists/[id]" (R6): one list's athletes with the company's latest note on each. Anyone the list
 * is shared with can remove athletes and add notes; only the owner can delete it. An athlete who
 * stops being open to recruiting drops out of the entries until they turn it back on.
 */
export default function RecruiterListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useRole();
  const { target } = useReviewState();
  const { state, reload } = useApi(() => api.list(id), [id]);
  useFocusEffect(reload);
  const [noteFor, setNoteFor] = useState<RecruiterListEntry | null>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const fail = (e: Error) => setError(e.message);
  const remove = (e: RecruiterListEntry) =>
    api.removeFromList(id, e.card.athleteId).then(() => {
      setStatus(`Removed ${e.card.firstName}`);
      reload();
    }, fail);
  const saveNote = () => {
    if (!noteFor) return;
    if (!note.trim()) {
      setNoteError('Write a note first.');
      return;
    }
    api.setListNote(id, noteFor.card.athleteId, note.trim()).then(
      () => {
        setNoteFor(null);
        setNote('');
        setStatus('Note saved for your team');
        reload();
      },
      (e: Error) => setNoteError(e.message),
    );
  };
  // Rethrows so the HoldButton resets when the delete fails.
  const del = () =>
    api.deleteList(id).then(
      () => {
        if (target?.id === id) setSaveTarget(null);
        router.back();
      },
      (e: Error) => {
        haptics.error();
        fail(e);
        throw e;
      },
    );

  const title = state.status === 'ready' ? state.data.name : 'List';
  return (
    <Screen eyebrow="List" title={title} back>
      <Async state={state}>
        {(l) => {
          const isTarget = target
            ? target.id === l.id
            : l.name.toLowerCase() === DEFAULT_LIST_NAME.toLowerCase();
          const mine = l.owner.id === me?.id;
          return (
            <Gutter>
              <View style={styles.meta}>
                <ListDot color={l.color} />
                <Text variant="small" color="secondary" style={styles.grow}>
                  {mine
                    ? l.sharedWith.length
                      ? `Shared with ${l.sharedWith.map(fullName).join(', ')}`
                      : 'Just you'
                    : `From ${fullName(l.owner)}`}{' '}
                  · {count(l.entries.length)}
                </Text>
              </View>
              {l.note && <Text color="secondary">{l.note}</Text>}

              {l.entries.length === 0 && (
                <Card>
                  <Text color="secondary">
                    Nobody here yet. Save athletes from quick review or from their card.
                  </Text>
                </Card>
              )}
              {l.entries.map((e) => (
                <Card key={e.card.athleteId}>
                  <Pressable
                    onPress={() => router.push(`/review/athletes/${e.card.athleteId}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${fullName(e.card)}’s card`}
                    style={({ pressed }) => [styles.entry, pressed && styles.pressed]}
                  >
                    <JerseyTile card={e.card} />
                    <View style={styles.grow}>
                      <Text weight="semibold">{fullName(e.card)}</Text>
                      <Text variant="small" color="secondary">
                        {[e.card.major, `Class of ${e.card.classYear}`, e.card.team?.sport]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    <Icon name="chevron" size={18} color={colors.text.muted} />
                  </Pressable>
                  {e.latestNote ? (
                    <View style={styles.note}>
                      <Text variant="small">“{e.latestNote.text}”</Text>
                      <Text variant="caption" color="secondary">
                        {fullName(e.latestNote.author)} · {shortDate(e.latestNote.createdAt)}
                      </Text>
                    </View>
                  ) : (
                    <Text variant="caption" color="secondary">
                      Added by {fullName(e.addedBy)} · {shortDate(e.addedAt)}
                    </Text>
                  )}
                  <View style={styles.actions}>
                    <Button
                      label={e.latestNote ? 'New note' : 'Add note'}
                      variant="secondary"
                      size="sm"
                      stretch
                      onPress={() => {
                        setNote('');
                        setNoteError(undefined);
                        setNoteFor(e);
                      }}
                    />
                    <Button
                      label="Remove"
                      variant="secondary"
                      size="sm"
                      stretch
                      accessibilityLabel={`Remove ${fullName(e.card)} from ${l.name}`}
                      onPress={() => void remove(e)}
                    />
                  </View>
                </Card>
              ))}

              {status && (
                <Text variant="small" color="success" accessibilityLiveRegion="polite">
                  {status}
                </Text>
              )}
              {error && <ErrorText>{error}</ErrorText>}

              <Button
                label={isTarget ? 'Swipes save to this list' : 'Save my swipes to this list'}
                icon={isTarget ? 'check' : 'heart'}
                variant="brand"
                disabled={isTarget}
                onPress={() => {
                  setSaveTarget({ id: l.id, name: l.name });
                  setStatus(`Quick review now saves to ${l.name}`);
                }}
              />
              {mine && (
                <View style={styles.danger}>
                  <Text variant="small" color="secondary">
                    Deleting it removes the list for everyone it’s shared with. Notes on its
                    athletes are kept.
                  </Text>
                  <HoldButton label="Hold to delete list" look="danger" onComplete={del} />
                </View>
              )}

              <Sheet
                visible={!!noteFor}
                title={noteFor ? `Note on ${noteFor.card.firstName}` : 'Note'}
                onClose={() => setNoteFor(null)}
              >
                <Input
                  label="Note for your team"
                  placeholder="Strong fit for the spring analyst cohort."
                  multiline
                  maxLength={2000}
                  value={note}
                  onChangeText={setNote}
                  error={noteError}
                />
                <Text variant="caption" color="secondary">
                  Everyone at your company sees notes. The athlete never does.
                </Text>
                <Button label="Save note" onPress={saveNote} />
              </Sheet>
            </Gutter>
          );
        }}
      </Async>
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1, gap: spacing.xs },
  entry: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pressed: { opacity: 0.8 },
  note: {
    gap: spacing.xs,
    paddingLeft: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.line,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  danger: { gap: spacing.sm, marginTop: spacing.sm },
});
