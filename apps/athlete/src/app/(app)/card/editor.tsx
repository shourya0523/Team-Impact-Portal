import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  REGIONS,
  type MyCardState,
  type Region,
  type UpdateCardRequest,
} from '@team-impact/contracts';
import { spacing } from '@team-impact/ui-tokens';
import { api, ApiRequestError } from '@/api';
import { FIELD_LABEL } from '@/components/cardData';
import { Async, Chip, ErrorText, Gutter, Screen, SectionLabel } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { Button, Card, Input, Text } from '@/ui';

type TextField =
  'position' | 'jerseyNumber' | 'major' | 'hometown' | 'city' | 'experience' | 'lookingFor';

const TEXT_FIELDS: { key: TextField; placeholder: string; multiline?: boolean }[] = [
  { key: 'major', placeholder: 'Economics' },
  { key: 'position', placeholder: 'Midfielder' },
  { key: 'jerseyNumber', placeholder: '07' },
  { key: 'hometown', placeholder: 'Lowell, MA' },
  { key: 'city', placeholder: 'Medford' },
  {
    key: 'experience',
    placeholder: 'One role per line, e.g. Investment club treasurer',
    multiline: true,
  },
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

/** Empty text means "not set", so optional fields clear rather than fail validation. */
const toRequest = (form: Record<string, string>, region: Region | null): UpdateCardRequest => {
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
    // Newlines are how the editor separates roles; the card stores them `;`-separated.
    experience:
      text('experience')
        ?.split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .join('; ') || null,
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
    experience: (initial.experience ?? '')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .join('\n'),
    lookingFor: initial.lookingFor ?? '',
    skills: (initial.skills ?? []).join(', '),
  }));
  const [region, setRegion] = useState<Region | null>(initial.region ?? null);
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (e: Error) => {
    setBusy(false);
    if (e instanceof ApiRequestError && e.body.error.issues) {
      setIssues(
        Object.fromEntries(e.body.error.issues.map((i) => [String(i.path[1] ?? ''), i.message])),
      );
    }
    setError(e.message);
  };

  const save = (thenPublish: boolean) => {
    setBusy(true);
    setIssues({});
    setError(null);
    return api
      .saveCardDraft(toRequest(form, region))
      .then(() => (thenPublish ? api.publishCard() : undefined))
      .then(() => router.replace('/card'), fail);
  };

  const set = (key: string) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

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
      <View style={styles.actions}>
        <Button
          label="Save draft"
          variant="secondary"
          stretch
          disabled={busy}
          onPress={() => save(false)}
        />
        <Button label="Publish" stretch disabled={busy} onPress={() => save(true)} />
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
});
