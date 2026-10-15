import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { canCreateEventIn } from '@team-impact/contracts';
import { spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { CommunityPicker } from '@/components/activity';
import { Async, ErrorText, Gutter, Screen } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { Button, Input, Text } from '@/ui';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** A local date and time typed as `2026-11-01` and `18:30`, as an ISO instant; null if invalid. */
const toInstant = (date: string, time: string) => {
  if (!DATE.test(date.trim()) || !TIME.test(time.trim())) return null;
  const [h = '0', m = '0'] = time.trim().split(':');
  const d = new Date(`${date.trim()}T${h.padStart(2, '0')}:${m}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/**
 * "/events/new": an event in one community, so team events stay inside the team. Parents and
 * teens can't create events. The event waits for review before members see it, and it always
 * shows who made it and their role. `?communityId=` preselects one.
 */
export default function CreateEvent() {
  const { role } = useRole();
  const params = useLocalSearchParams<{ communityId?: string }>();
  const { state } = useApi(() => api.communities());
  const [picked, setPicked] = useState<string | null>(params.communityId ?? null);
  const [form, setForm] = useState({
    title: '',
    date: '',
    start: '',
    end: '',
    location: '',
    details: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm({ ...form, [k]: v });

  return (
    <Screen eyebrow="Events" title="New event" back>
      <Async state={state}>
        {(all) => {
          const options = role ? all.filter((x) => canCreateEventIn(role, x)) : [];
          const communityId =
            picked && options.some((x) => x.id === picked)
              ? picked
              : options.length === 1
                ? options[0]!.id
                : null;
          if (!role || role === 'parent' || role === 'teen') {
            return (
              <Gutter>
                <Text color="secondary">
                  You can RSVP to events in your communities, but creating them isn’t available for
                  your account.
                </Text>
              </Gutter>
            );
          }
          const submit = () => {
            const startsAt = toInstant(form.date, form.start);
            const endsAt = form.end.trim() ? toInstant(form.date, form.end) : undefined;
            if (!communityId) return setError('Pick a community.');
            if (!startsAt) return setError('Use a date like 2026-11-01 and a time like 18:30.');
            if (endsAt === null) return setError('Use an end time like 20:00.');
            setBusy(true);
            setError(null);
            api
              .createEvent(communityId, {
                title: form.title,
                location: form.location,
                startsAt,
                ...(endsAt ? { endsAt } : {}),
                ...(form.details.trim() ? { details: form.details } : {}),
              })
              .then(
                (e) => router.replace({ pathname: '/events/[id]', params: { id: e.id } }),
                (e: Error) => setError(e.message),
              )
              .finally(() => setBusy(false));
          };
          return (
            <Gutter gap="lg">
              <View style={styles.block}>
                <Text weight="semibold">Where it’s shared</Text>
                <CommunityPicker options={options} value={communityId} onChange={setPicked} />
              </View>
              <Input label="Title" value={form.title} onChangeText={set('title')} maxLength={120} />
              <Input
                label="Date"
                value={form.date}
                onChangeText={set('date')}
                placeholder="2026-11-01"
                autoCapitalize="none"
              />
              <View style={styles.row}>
                <View style={styles.grow}>
                  <Input
                    label="Starts"
                    value={form.start}
                    onChangeText={set('start')}
                    placeholder="18:30"
                  />
                </View>
                <View style={styles.grow}>
                  <Input
                    label="Ends (optional)"
                    value={form.end}
                    onChangeText={set('end')}
                    placeholder="20:00"
                  />
                </View>
              </View>
              <Input
                label="Place"
                value={form.location}
                onChangeText={set('location')}
                maxLength={200}
              />
              <Input
                label="Details (optional)"
                value={form.details}
                onChangeText={set('details')}
                multiline
                maxLength={2000}
                textAlignVertical="top"
              />
              <Text variant="small" color="secondary">
                Members see your name and role on the event. Team Impact reviews it first.
              </Text>
              {error && <ErrorText>{error}</ErrorText>}
              <Button
                label={busy ? 'Creating…' : 'Create event'}
                disabled={busy || !form.title.trim() || !form.location.trim() || !communityId}
                onPress={submit}
              />
            </Gutter>
          );
        }}
      </Async>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
});
