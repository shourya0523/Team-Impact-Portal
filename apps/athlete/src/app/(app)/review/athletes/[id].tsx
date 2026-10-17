import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { RecruiterNote } from '@team-impact/contracts';
import { AthleteCard } from '@team-impact/ui-primitives/native';
import { colors, spacing } from '@team-impact/ui-tokens';
import { api, ApiRequestError } from '@/api';
import { toCardData } from '@/components/cardData';
import { shortDate } from '@/components/format';
import { ListDot, ListPickerSheet, SavedFlash } from '@/components/recruiter-parts';
import {
  fullName,
  REGION_NAME,
  saveToTarget,
  targetName,
  useReviewState,
} from '@/components/recruiter-state';
import { Async, ErrorText, Gutter, Screen, SectionLabel } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { Button, Card, haptics, Icon, Input, Text, type IconName } from '@/ui';

const MAX_CARD_WIDTH = 360;

const withScheme = (url: string) => (/^https?:\/\//.test(url) ? url : `https://${url}`);

function ContactRow({
  icon,
  label,
  value,
  url,
}: {
  icon: IconName;
  label: string;
  value: string;
  url: string;
}) {
  return (
    <Card
      onPress={() => void Linking.openURL(url)}
      label={`${label}: ${value}`}
      style={styles.contact}
    >
      <Icon name={icon} size={20} color={colors.brand} />
      <View style={styles.grow}>
        <Text variant="small" color="secondary">
          {label}
        </Text>
        <Text weight="semibold" color="brand">
          {value}
        </Text>
      </View>
      <Icon name="chevron" size={18} color={colors.text.muted} />
    </Card>
  );
}

/**
 * "/review/athletes/[id]" (R5): the athlete's Baseball Card as a recruiter sees it, the contact
 * details they chose to share with recruiters, the company's notes and the lists they're on.
 * There is no messaging: recruiters reach out outside the app.
 */
export default function RecruiterCard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const { target } = useReviewState();
  const card = useApi(() => api.recruiterCard(id), [id]);
  const lists = useApi(
    () => api.lists().then((all) => Promise.all(all.map((l) => api.list(l.id)))),
    [id],
  );
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | undefined>();
  const cardWidth = Math.min(width - spacing.md * 2, MAX_CARD_WIDTH);

  const unavailable =
    card.state.status === 'error' &&
    card.state.error instanceof ApiRequestError &&
    card.state.error.status === 404;
  if (unavailable) {
    return (
      <Screen title="Not available" back>
        <Gutter>
          <Text color="secondary">
            This athlete isn’t open to recruiting right now, so their card is hidden.
          </Text>
        </Gutter>
      </Screen>
    );
  }

  const name = card.state.status === 'ready' ? fullName(card.state.data) : 'Athlete';
  const save = () => {
    setBusy(true);
    setError(null);
    saveToTarget(id)
      .then(
        (r) => {
          haptics.success();
          setFlash((n) => n + 1);
          setStatus(r.already ? `Already in ${r.list}` : `Saved to ${r.list}`);
          lists.reload();
        },
        (e: Error) => {
          haptics.error();
          setError(e.message);
        },
      )
      .finally(() => setBusy(false));
  };

  return (
    <Screen
      eyebrow={
        card.state.status === 'ready'
          ? (card.state.data.team?.college.name ?? 'Team Impact alumni')
          : 'Athlete'
      }
      title={name}
      back
    >
      <Async state={card.state}>
        {(c) => {
          const facts = [
            c.team && `${c.team.name} · Division ${c.team.division}`,
            `Class of ${c.classYear} · ${c.major}`,
            [c.city, c.region && REGION_NAME[c.region]].filter(Boolean).join(' · '),
          ].filter(Boolean);
          const contacts = [
            c.contact.email && {
              icon: 'mail' as const,
              label: 'Email',
              value: c.contact.email,
              url: `mailto:${c.contact.email}`,
            },
            c.contact.phone && {
              icon: 'user' as const,
              label: 'Phone',
              value: c.contact.phone,
              url: `tel:${c.contact.phone.replace(/[^\d+]/g, '')}`,
            },
            c.contact.linkedinUrl && {
              icon: 'briefcase' as const,
              label: 'LinkedIn',
              value: c.contact.linkedinUrl.replace(/^https?:\/\/(www\.)?/, ''),
              url: withScheme(c.contact.linkedinUrl),
            },
          ].filter((x) => !!x);
          return (
            <>
              <Gutter>
                <View style={styles.cardWrap}>
                  <AthleteCard athlete={toCardData(c, c.contact)} width={cardWidth} />
                </View>
                <Text variant="small" color="secondary" style={styles.center}>
                  Tap or swipe the card to see the back.
                </Text>
                <View style={styles.facts}>
                  {facts.map((f) => (
                    <Text key={f} variant="small" color="secondary" style={styles.center}>
                      {f}
                    </Text>
                  ))}
                </View>
              </Gutter>

              <SectionLabel>{`Contact ${c.firstName}`}</SectionLabel>
              <Gutter gap="sm">
                {contacts.length ? (
                  contacts.map((x) => <ContactRow key={x.label} {...x} />)
                ) : (
                  <Card>
                    <Text color="secondary">
                      {c.firstName} hasn’t shared contact details with recruiters.
                    </Text>
                  </Card>
                )}
                <Text variant="caption" color="secondary">
                  Only what {c.firstName} chose to share with recruiters. Reach out outside the app.
                </Text>
              </Gutter>

              {c.lookingFor && (
                <>
                  <SectionLabel>Looking for</SectionLabel>
                  <Gutter>
                    <Text>{c.lookingFor}</Text>
                  </Gutter>
                </>
              )}

              <SectionLabel>Your lists</SectionLabel>
              <Async state={lists.state}>
                {(details) => {
                  const on = details.filter((l) =>
                    l.entries.some((e) => e.card.athleteId === c.athleteId),
                  );
                  const notes = new Map<string, RecruiterNote>();
                  for (const l of on) {
                    const n = l.entries.find((e) => e.card.athleteId === c.athleteId)?.latestNote;
                    if (n) notes.set(n.id, n);
                  }
                  const saveNote = () => {
                    if (!note.trim()) {
                      setNoteError('Write a note first.');
                      return;
                    }
                    setNoteError(undefined);
                    api.setListNote(on[0]!.id, c.athleteId, note.trim()).then(
                      () => {
                        setNote('');
                        setStatus('Note saved for your team');
                        lists.reload();
                      },
                      (e: Error) => setNoteError(e.message),
                    );
                  };
                  return (
                    <Gutter>
                      {on.length ? (
                        <View style={styles.lists}>
                          {on.map((l) => (
                            <Card
                              key={l.id}
                              onPress={() => router.navigate(`/lists/${l.id}`)}
                              label={`Open ${l.name}`}
                              style={styles.listChip}
                            >
                              <ListDot color={l.color} />
                              <Text variant="small" weight="semibold">
                                {l.name}
                              </Text>
                            </Card>
                          ))}
                        </View>
                      ) : (
                        <Text color="secondary">Not on any of your lists yet.</Text>
                      )}
                      <View style={styles.actions}>
                        <SavedFlash flash={flash} stretch>
                          <Button
                            label={`Save to ${targetName(target)}`}
                            stretch
                            icon="heart"
                            disabled={busy}
                            onPress={save}
                          />
                        </SavedFlash>
                        <Button
                          label="Change list"
                          variant="secondary"
                          onPress={() => setPicking(true)}
                        />
                      </View>
                      {status && (
                        <Text variant="small" color="success" accessibilityLiveRegion="polite">
                          {status}
                        </Text>
                      )}
                      {error && <ErrorText>{error}</ErrorText>}

                      {[...notes.values()].map((n) => (
                        <Card key={n.id}>
                          <Text variant="small" color="secondary">
                            {fullName(n.author)} · {shortDate(n.createdAt)}
                          </Text>
                          <Text>{n.text}</Text>
                        </Card>
                      ))}
                      {on.length > 0 && (
                        <>
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
                            Everyone at your company sees notes. {c.firstName} never does.
                          </Text>
                          <Button label="Save note" variant="secondary" onPress={saveNote} />
                        </>
                      )}
                    </Gutter>
                  );
                }}
              </Async>
            </>
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
  cardWrap: { alignItems: 'center', paddingVertical: spacing.sm },
  center: { textAlign: 'center' },
  facts: { gap: spacing.xs },
  contact: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1, gap: spacing.xs },
  lists: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  listChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
