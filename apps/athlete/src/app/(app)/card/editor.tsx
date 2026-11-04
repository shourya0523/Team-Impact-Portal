import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
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
import { useRole } from '@/navigation/role';
import { Avatar, Button, Card, Input, Text, type InputProps } from '@/ui';

type TextField = 'position' | 'jerseyNumber' | 'hometown' | 'city' | 'lookingFor';

/** The photo is resized on the device to this width (square) before it's saved. */
const PHOTO_SIZE = 600;
const PHOTO_QUALITY = 0.7;

/**
 * Pick a square photo, as the card demo does, and shrink it to a small JPEG data URL the API
 * stores with the draft. Null when the athlete cancels.
 */
const pickPhoto = async (): Promise<string | null> => {
  // The system picker needs no permission prompt; it's scoped to the one photo chosen.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  const image = await ImageManipulator.manipulate(asset.uri)
    .resize({ width: PHOTO_SIZE, height: PHOTO_SIZE })
    .renderAsync();
  try {
    const { base64 } = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: PHOTO_QUALITY,
      base64: true,
    });
    if (!base64) throw new Error('Couldn’t read that photo. Try another one.');
    return `data:image/jpeg;base64,${base64}`;
  } finally {
    image.release();
  }
};

/** Extra props for an editor field beyond label, value and error. */
type InputExtras = Omit<InputProps, 'label' | 'value' | 'onChangeText' | 'error'>;

/** "7" is saved as "07", the way the card prints it. */
const padJersey = (v: string | null) => (v && /^\d$/.test(v) ? `0${v}` : v);

const REGION_LABEL: Record<Region, string> = {
  northeast: 'Northeast',
  midwest: 'Midwest',
  south: 'South',
  west: 'West',
};

/** The editor's starting values: the stored card with the draft on top. */
const startingValues = ({ card, draft }: MyCardState): UpdateCardRequest => ({
  ...(card && {
    firstName: card.firstName,
    lastName: card.lastName,
    photoUrl: card.photoUrl,
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
    // Names and major are required: blank means "leave as saved", never "clear".
    firstName: form.firstName?.trim() || undefined,
    lastName: form.lastName?.trim() || undefined,
    major: form.major?.trim() || undefined,
    classYear: Number.isInteger(year) && year > 0 ? year : undefined,
    position: text('position'),
    jerseyNumber: padJersey(text('jerseyNumber')),
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

/** Two fields side by side, like the mockup's First | Last and Position | Number. */
function Pair({ children }: { children: ReactNode[] }) {
  return (
    <View style={styles.pair}>
      {children.map((child, i) => (
        <View key={i} style={styles.half}>
          {child}
        </View>
      ))}
    </View>
  );
}

function Editor({
  initial,
  season,
  hasCard,
}: {
  initial: UpdateCardRequest;
  season: number;
  hasCard: boolean;
}) {
  const [form, setForm] = useState<Record<string, string>>(() => ({
    firstName: initial.firstName ?? '',
    lastName: initial.lastName ?? '',
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
  const [photo, setPhoto] = useState<string | null>(initial.photoUrl ?? null);
  /** Only a changed photo is sent, so saving other fields never re-uploads it. */
  const [photoChanged, setPhotoChanged] = useState(false);

  const choosePhoto = () => {
    setError(null);
    pickPhoto().then(
      (picked) => {
        if (!picked) return;
        setPhoto(picked);
        setPhotoChanged(true);
      },
      (e: Error) => setError(e.message),
    );
  };
  const removePhoto = () => {
    setPhoto(null);
    setPhotoChanged(true);
  };

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
      .saveCardDraft({
        ...toRequest(form, region, experience),
        ...(photoChanged && { photoUrl: photo }),
      })
      .then(() => (thenPublish ? api.publishCard() : undefined))
      .then(() => router.replace('/card'), fail);
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

  const field = (key: TextField | 'firstName' | 'lastName' | 'major', props: InputExtras = {}) => (
    <Input
      label={FIELD_LABEL[key]}
      value={form[key]}
      onChangeText={set(key)}
      error={issues[key]}
      {...props}
    />
  );

  return (
    <Gutter>
      <SectionLabel>About you</SectionLabel>
      <View style={styles.photo}>
        <Avatar
          name={`${form.firstName} ${form.lastName}`.trim() || 'Your photo'}
          uri={photo ?? undefined}
          size="lg"
        />
        <View style={styles.photoActions}>
          <Button
            label={photo ? 'Change photo' : 'Add a photo'}
            variant="secondary"
            size="sm"
            icon="user"
            onPress={choosePhoto}
          />
          {photo && <Button label="Remove" variant="secondary" size="sm" onPress={removePhoto} />}
        </View>
      </View>
      {issues.photoUrl && <ErrorText>{issues.photoUrl}</ErrorText>}
      <Pair>
        {field('firstName', { autoComplete: 'given-name', textContentType: 'givenName' })}
        {field('lastName', { autoComplete: 'family-name', textContentType: 'familyName' })}
      </Pair>
      <Pair>
        {field('position', { placeholder: 'Midfielder' })}
        {field('jerseyNumber', { placeholder: '07', keyboardType: 'number-pad', maxLength: 2 })}
      </Pair>

      <SectionLabel>Academics</SectionLabel>
      {field('major', { placeholder: 'Economics' })}
      <Input
        label={FIELD_LABEL.classYear}
        value={form.classYear}
        onChangeText={set('classYear')}
        keyboardType="number-pad"
        maxLength={4}
        placeholder="2027"
        error={issues.classYear}
      />

      <SectionLabel>Where you want to work</SectionLabel>
      {field('city', { placeholder: 'Boston' })}
      <Text variant="small" weight="semibold" color="secondary">
        {FIELD_LABEL.region}
      </Text>
      <View accessibilityRole="radiogroup" style={styles.chips}>
        {REGIONS.map((r) => (
          <Chip
            key={r}
            label={REGION_LABEL[r]}
            selected={region === r}
            onPress={() => setRegion(region === r ? null : r)}
          />
        ))}
      </View>
      {field('hometown', { placeholder: 'Lowell, MA' })}

      <SectionLabel>Experience and skills</SectionLabel>
      <Text variant="small" color="secondary">
        {`Up to ${MAX_EXPERIENCE_ENTRIES}. Each one is a row on your card, in this order.`}
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
        placeholder="Excel, SQL, team captain"
        error={issues.skills}
      />
      {field('lookingFor', { placeholder: 'Finance internships, Boston', multiline: true })}

      <Card>
        <Text variant="small" color="secondary">
          {`Saved as your ${season} season card. ${
            hasCard
              ? 'Saving keeps changes private; publishing shows them wherever your card appears.'
              : 'Nobody sees it until you publish.'
          } No health details, please.`}
        </Text>
      </Card>
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

/**
 * "/card/editor": every card field, typed by hand or corrected after a resume upload. Saves go to
 * a private draft for the current season; nobody sees them until Publish.
 */
export default function CardEditor() {
  const { me } = useRole();
  const { state } = useApi(() => api.myCard());
  return (
    <Screen eyebrow="Baseball Card" title="Edit card" back>
      <Async state={state}>
        {(s) => (
          <Editor
            // Before the first card, the names start from the account; a saved card or draft wins.
            initial={{ firstName: me?.firstName, lastName: me?.lastName, ...startingValues(s) }}
            season={s.currentSeason}
            hasCard={!!s.card}
          />
        )}
      </Async>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  photo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  photoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
