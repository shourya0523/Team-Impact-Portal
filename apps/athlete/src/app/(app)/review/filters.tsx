import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DIVISIONS, REGIONS } from '@team-impact/contracts';
import { spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import {
  REGION_NAME,
  setReviewFilters,
  toSearchQuery,
  useReviewState,
  type ReviewFilters,
} from '@/components/recruiter-state';
import { Async, Chip, Gutter, Screen, SectionLabel } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { Button, Card, Input, Text } from '@/ui';

type TextKey = 'sport' | 'major' | 'classYear' | 'city' | 'experience';
const TEXT_FIELDS: { key: TextKey; label: string; placeholder: string; numeric?: boolean }[] = [
  { key: 'sport', label: 'Sport', placeholder: 'e.g. Soccer' },
  { key: 'major', label: 'Major', placeholder: 'e.g. Economics' },
  { key: 'classYear', label: 'Grad year', placeholder: 'e.g. 2027', numeric: true },
  { key: 'city', label: 'City', placeholder: 'e.g. Boston' },
  { key: 'experience', label: 'Experience', placeholder: 'e.g. internship' },
];

const clean = (f: ReviewFilters): ReviewFilters =>
  Object.fromEntries(
    Object.entries(f).filter(([, v]) => v !== undefined && !(typeof v === 'string' && !v.trim())),
  );

const leave = () => (router.canGoBack() ? router.back() : router.replace('/review'));

/**
 * "/review/filters" (R7): what the quick review deck shows. Applying replaces the deck's filters
 * for the rest of the session. The official-community filter shows only while identity search is
 * on, and offers official interest communities only: never team, medical or private ones.
 */
export default function ReviewFiltersScreen() {
  const { filters } = useReviewState();
  const [draft, setDraft] = useState<ReviewFilters>(filters);
  // Text boxes count only once the recruiter finishes a value, so the count doesn't flicker.
  const [counted, setCounted] = useState<ReviewFilters>(filters);
  const countKey = JSON.stringify(clean(counted));
  const matches = useApi(() => api.searchAthletes(toSearchQuery(clean(counted))), [countKey]);
  const flags = useApi(() => api.flags());
  const identity = flags.state.status === 'ready' && flags.state.data.identitySearch;
  const official = useApi(
    () =>
      identity
        ? api
            .communities()
            .then((all) => all.filter((c) => c.kind === 'interest' && c.official && !c.private))
        : Promise.resolve([]),
    [identity],
  );

  const change = (next: ReviewFilters, count = true) => {
    setDraft(next);
    if (count) setCounted(next);
  };
  const toggle = <K extends 'region' | 'division'>(k: K, v: ReviewFilters[K]) =>
    change({ ...draft, [k]: draft[k] === v ? undefined : v });

  const n =
    matches.state.status === 'ready'
      ? `${matches.state.data.items.length}${matches.state.data.nextCursor ? '+' : ''}`
      : null;

  const apply = () => {
    setReviewFilters(clean(draft));
    leave();
  };

  return (
    <Screen
      eyebrow="Quick review"
      title="Filters"
      back
      right={
        <Button
          label="Clear"
          variant="secondary"
          size="sm"
          onPress={() => change({})}
          disabled={!Object.keys(clean(draft)).length}
        />
      }
    >
      <SectionLabel>Region</SectionLabel>
      <Gutter>
        <View style={styles.chips}>
          {REGIONS.map((r) => (
            <Chip
              key={r}
              label={REGION_NAME[r]}
              selected={draft.region === r}
              onPress={() => toggle('region', r)}
            />
          ))}
        </View>
      </Gutter>

      <SectionLabel>Division</SectionLabel>
      <Gutter>
        <View style={styles.chips}>
          {DIVISIONS.map((d) => (
            <Chip
              key={d}
              label={`Division ${d}`}
              selected={draft.division === d}
              onPress={() => toggle('division', d)}
            />
          ))}
        </View>
      </Gutter>

      <SectionLabel>Athlete</SectionLabel>
      <Gutter>
        {TEXT_FIELDS.map((f) => (
          <Input
            key={f.key}
            label={f.label}
            placeholder={f.placeholder}
            value={draft[f.key] ?? ''}
            keyboardType={f.numeric ? 'number-pad' : 'default'}
            maxLength={f.numeric ? 4 : 80}
            returnKeyType="done"
            onChangeText={(v) => change({ ...draft, [f.key]: v }, false)}
            onBlur={() => setCounted(draft)}
            onSubmitEditing={() => setCounted(draft)}
          />
        ))}
      </Gutter>

      {identity && (
        <>
          <SectionLabel>Official community</SectionLabel>
          <Gutter>
            <Async state={official.state}>
              {(communities) =>
                communities.length ? (
                  <View style={styles.chips}>
                    {communities.map((c) => (
                      <Chip
                        key={c.id}
                        label={c.name}
                        selected={draft.community?.id === c.id}
                        onPress={() =>
                          change({
                            ...draft,
                            community:
                              draft.community?.id === c.id ? undefined : { id: c.id, name: c.name },
                          })
                        }
                      />
                    ))}
                  </View>
                ) : (
                  <Text variant="small" color="secondary">
                    No official communities yet.
                  </Text>
                )
              }
            </Async>
            <Text variant="small" color="secondary">
              Only members who chose to be found through a community appear, and every search with
              this filter is logged.
            </Text>
          </Gutter>
        </>
      )}

      <Gutter>
        <Card>
          <Text variant="small" color="secondary">
            Only athletes who published their Baseball Card and are open to recruiting.
          </Text>
          <Button
            label={n === null ? 'Show athletes' : `Show ${n} ${n === '1' ? 'athlete' : 'athletes'}`}
            onPress={apply}
          />
        </Card>
      </Gutter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
