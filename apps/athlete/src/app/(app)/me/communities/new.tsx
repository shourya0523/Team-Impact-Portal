import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  canCreateCommunity,
  CREATABLE_COMMUNITY_KINDS,
  type CreatableCommunityKind,
} from '@team-impact/contracts';
import { spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { Async, ErrorText, Gutter, Screen, Segmented } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { Button, Input, Text } from '@/ui';

const KIND_COPY: Record<CreatableCommunityKind, { label: string; hint: string }> = {
  interest: {
    label: 'Interest',
    hint: 'A shared interest, background or goal. Staff can make an open one official.',
  },
  medical: {
    label: 'Medical',
    hint: 'For families and supporters. Membership is private: never on a profile, in search or shown to recruiters.',
  },
};

type Access = 'open' | 'private';

/**
 * "/me/communities/new": an interest or medical community, open or private (set now, for good).
 * Who can make which follows PRD §5 (`canCreateCommunity`): parents make medical ones only; teens
 * and recruiters make neither medical nor interest. The medical kind is gone entirely when its
 * switch is off. Name and description wait for review; names are unique per kind.
 */
export default function CreateCommunity() {
  const { role } = useRole();
  const { state } = useApi(() => api.flags());
  const [picked, setPicked] = useState<CreatableCommunityKind | null>(null);
  const [access, setAccess] = useState<Access>('open');
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen eyebrow="Communities" title="Create community" back>
      <Async state={state}>
        {(flags) => {
          const kinds = CREATABLE_COMMUNITY_KINDS.filter(
            (k) =>
              !!role &&
              canCreateCommunity(role, k) &&
              (k !== 'medical' || flags.medicalCommunities),
          );
          const kind = picked && kinds.includes(picked) ? picked : (kinds[0] ?? null);
          if (!kind) {
            return (
              <Gutter>
                <Text color="secondary">
                  Creating communities isn’t available for your account.
                </Text>
              </Gutter>
            );
          }
          const submit = () => {
            setBusy(true);
            setError(null);
            api
              .createCommunity({ kind, name, about, private: access === 'private' })
              .then(
                (c) => router.replace({ pathname: '/me/communities/[id]', params: { id: c.id } }),
                (e: Error) => setError(e.message),
              )
              .finally(() => setBusy(false));
          };
          return (
            <Gutter gap="lg">
              {kinds.length > 1 && (
                <View style={styles.block}>
                  <Segmented
                    label="Kind of community"
                    options={kinds.map((k) => ({ value: k, label: KIND_COPY[k].label }))}
                    value={kind}
                    onChange={setPicked}
                  />
                </View>
              )}
              <Text variant="small" color="secondary">
                {KIND_COPY[kind].hint}
              </Text>
              <Input label="Name" value={name} onChangeText={setName} maxLength={60} />
              <Input
                label="What it’s for"
                value={about}
                onChangeText={setAbout}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
              <View style={styles.block}>
                <Text weight="semibold">Who can see posts and members</Text>
                <Segmented
                  label="Open or private"
                  options={[
                    { value: 'open', label: 'Open' },
                    { value: 'private', label: 'Private' },
                  ]}
                  value={access}
                  onChange={setAccess}
                />
                <Text variant="small" color="secondary">
                  {access === 'open'
                    ? 'Anyone who can join sees its posts and joins straight away.'
                    : 'People can find it by name, but posts, events and members are for members only. You approve who joins. A private community can’t become official. You can’t change this later.'}
                </Text>
              </View>
              <Text variant="small" color="secondary">
                Team Impact reviews the name and description before others can find it.
              </Text>
              {error && <ErrorText>{error}</ErrorText>}
              <Button
                label={busy ? 'Creating…' : 'Create community'}
                disabled={busy || !name.trim() || !about.trim()}
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
});
