import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  MAX_EXPERIENCE_ENTRIES,
  REGIONS,
  type ExperienceEntry,
  type MyCardState,
  type Region,
  type UpdateCardRequest,
} from '@team-impact/contracts';
import { spacing } from '@team-impact/ui-tokens';
import { api, ApiRequestError } from '@/api';
import { FIELD_LABEL } from '@/components/cardData';
import { Async, Chip, ErrorText, Gutter, Screen, SectionLabel } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { Button, Card, haptics, HoldButton, Input, Text } from '@/ui';

type TextField = 'position' | 'jerseyNumber' | 'major' | 'hometown' | 'city' | 'lookingFor';

const TEXT_FIELDS: { key: TextField; placeholder: string; multiline?: boolean }[] = [
  { key: 'major', placeholder: 'Economics' },
  { key: 'position', placeholder: 'Midfielder' },
  { key: 'jerseyNumber', placeholder: '07' },
  { key: 'hometown', placeholder: 'Lowell, MA' },
  { key: 'city', placeholder: 'Medford' },
  { key: 'lookingFor', placeholder: 'Finance internship, summer 2027', multiline: true },
];

const REGION_LABEL: Record<Region, string> = {
  northeast: 'Northeast',
  midwest: 'Midwest',
  south: 'South',
  west: 'West',
};

/** The editor's starting values: the stored card with the draft on top. */
const startingValues = ({ card, draft }: MyCardState): UpdateCardRequest => ({
  ...(card && {
    position: card.position,
    jerseyNumber: card.jerseyNumber,
    classYear: card.classYear,
    major: card.major,
    hometown: card.hometown,
    city: card.city,
    region: card.region,
    experience: card.experience,
    skills: card.skills,
    lookingFor: card.lookingFor,
  }),
  ...draft,
});

const ENTRY_FIELDS: { key: keyof ExperienceEntry; label: string; placeholder: string }[] = [
  { key: 'role', label: 'Role', placeholder: 'Treasurer' },
  { key: 'organization', label: 'Organization', placeholder: 'Investment club' },
  { key: 'period', label: 'When', placeholder: '2025 – Now' },
];

const blankEntry = (): ExperienceEntry => ({ role: '', organization: '', period: '' });

/** Empty text means "not set", so optional fields clear rather than fail validation. */
const toRequest = (
  form: Record<string, string>,
  region: Region | null,
  experience: ExperienceEntry[],
): UpdateCardRequest => {
  const text = (k: TextField) => {
    const v = form[k]?.trim() ?? '';
    return v === '' ? null : v;
  };
  const year = Number(form.classYear);
  return {
    major: form.major?.trim() || undefined,
    classYear: Number.isInteger(year) && year > 0 ? year : undefined,
    position: text('position'),
    jerseyNumber: text('jerseyNumber'),
    hometown: text('hometown'),
    city: text('city'),
    // Rows left completely blank are dropped; a row with only an organisation still needs a role.
    experience: experience
      .map((e) => ({
        role: e.role.trim(),
        organization: e.organization.trim(),
        period: e.period.trim(),
      }))
      .filter((e) => e.role || e.organization || e.period),
    lookingFor: text('lookingFor'),
    region,
    skills: (form.skills ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
};

function Editor({ initial }: { initial: UpdateCardRequest }) {
  const [form, setForm] = useState<Record<string, string>>(() => ({
    major: initial.major ?? '',
    classYear: initial.classYear ? String(initial.classYear) : '',
    position: initial.position ?? '',
    jerseyNumber: initial.jerseyNumber ?? '',
    hometown: initial.hometown ?? '',
    city: initial.city ?? '',
    lookingFor: initial.lookingFor ?? '',
    skills: (initial.skills ?? []).join(', '),
  }));
  const [region, setRegion] = useState<Region | null>(initial.region ?? null);
  const [experience, setExperience] = useState<ExperienceEntry[]>(() => [
    ...(initial.experience ?? []),
  ]);
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (e: Error) => {
    setBusy(false);
    if (e instanceof ApiRequestError && e.body.error.issues) {
      // Keyed by field ("major") and by full path ("experience.0.role") for the entry rows.
      setIssues(
        Object.fromEntries(
          e.body.error.issues.flatMap((i) => [
            [String(i.path[1] ?? ''), i.message],
            [i.path.slice(1).join('.'), i.message],
          ]),
        ),
      );
    }
    setError(e.message);
  };

  const save = (thenPublish: boolean) => {
    setBusy(true);
    setIssues({});
    setError(null);
    return api
      .saveCardDraft(toRequest(form, region, experience))
      .then(() => (thenPublish ? api.publishCard() : undefined))
      .then(
        () => {
          if (thenPublish) haptics.success();
          router.replace('/card');
        },
        (e: Error) => {
          if (thenPublish) haptics.error();
          fail(e);
        },
      );
  };

  const set = (key: string) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const setEntry = (i: number, key: keyof ExperienceEntry) => (value: string) =>
    setExperience((list) => list.map((e, n) => (n === i ? { ...e, [key]: value } : e)));
  const move = (i: number, by: -1 | 1) =>
    setExperience((list) => {
      const next = [...list];
      const [entry] = next.splice(i, 1);
      next.splice(i + by, 0, entry!);
      return next;
    });
  const remove = (i: number) => setExperience((list) => list.filter((_, n) => n !== i));

  return (
    <Gutter>
      <Card>
        <Text variant="small" color="secondary">
          Saving keeps your changes private. Publishing shows them to your team and, if you’re open
          to recruiting, to recruiters.
        </Text>
      </Card>
      <SectionLabel>About you</SectionLabel>
      <Input
        label={FIELD_LABEL.classYear}
        value={form.classYear}
        onChangeText={set('classYear')}
        keyboardType="number-pad"
        placeholder="2027"
        error={issues.classYear}
      />
      {TEXT_FIELDS.map((f) => (
        <Input
          key={f.key}
          label={FIELD_LABEL[f.key]}
          value={form[f.key]}
          onChangeText={set(f.key)}
          placeholder={f.placeholder}
          multiline={f.multiline}
          error={issues[f.key]}
        />
      ))}
      <SectionLabel>{`${FIELD_LABEL.experience} (up to ${MAX_EXPERIENCE_ENTRIES})`}</SectionLabel>
      <Text variant="small" color="secondary">
        Each one is a row on your card, in this order.
      </Text>
      {experience.map((entry, i) => (
        <Card key={i}>
          <Text weight="semibold">{`${FIELD_LABEL.experience} ${i + 1}`}</Text>
          {ENTRY_FIELDS.map((f) => (
            <Input
              key={f.key}
              label={f.label}
              value={entry[f.key]}
              onChangeText={setEntry(i, f.key)}
              placeholder={f.placeholder}
              error={issues[`experience.${i}.${f.key}`]}
            />
          ))}
          <View style={styles.actions}>
            <Button
              label="Up"
              variant="secondary"
              size="sm"
              stretch
              disabled={i === 0}
              accessibilityLabel={`Move ${FIELD_LABEL.experience.toLowerCase()} ${i + 1} up`}
              onPress={() => move(i, -1)}
            />
            <Button
              label="Down"
              variant="secondary"
              size="sm"
              stretch
              disabled={i === experience.length - 1}
              accessibilityLabel={`Move ${FIELD_LABEL.experience.toLowerCase()} ${i + 1} down`}
              onPress={() => move(i, 1)}
            />
            <Button
              label="Remove"
              variant="secondary"
              size="sm"
              stretch
              accessibilityLabel={`Remove ${FIELD_LABEL.experience.toLowerCase()} ${i + 1}`}
              onPress={() => remove(i)}
            />
          </View>
        </Card>
      ))}
      {issues.experience && !experience.some((_, i) => issues[`experience.${i}.role`]) && (
        <ErrorText>{issues.experience}</ErrorText>
      )}
      {experience.length < MAX_EXPERIENCE_ENTRIES && (
        <Button
          label="Add experience"
          icon="plus"
          variant="secondary"
          onPress={() => setExperience((list) => [...list, blankEntry()])}
        />
      )}
      <Input
        label={`${FIELD_LABEL.skills} (comma separated)`}
        value={form.skills}
        onChangeText={set('skills')}
        placeholder="Excel, Python, Spanish"
        error={issues.skills}
      />
      <SectionLabel>Region</SectionLabel>
      <View style={styles.chips}>
        {REGIONS.map((r) => (
          <Chip
            key={r}
            label={REGION_LABEL[r]}
            selected={region === r}
            onPress={() => setRegion(region === r ? null : r)}
          />
        ))}
      </View>
      {error && <ErrorText>{error}</ErrorText>}
      <View style={styles.publish}>
        <HoldButton
          label="Hold to publish card"
          look="sign"
          busy={busy}
          onComplete={() => save(true)}
        />
        <Button
          label="Save draft"
          variant="secondary"
          disabled={busy}
          onPress={() => save(false)}
        />
      </View>
    </Gutter>
  );
}

/** "/card/editor": every card field, typed by hand or corrected after a resume upload. */
export default function CardEditor() {
  const { state } = useApi(() => api.myCard());
  return (
    <Screen eyebrow="Baseball Card" title="Edit card" back>
      <Async state={state}>{(s) => <Editor initial={startingValues(s)} />}</Async>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  publish: { gap: spacing.sm, marginTop: spacing.sm },
});
