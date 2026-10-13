import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { canPostIn } from '@team-impact/contracts';
import { spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { CommunityPicker } from '@/components/activity';
import { Async, ErrorText, Gutter, Screen } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { Button, Input, Text } from '@/ui';

/**
 * "/home/compose": a new post into one community. Staff, coaches, athletes and alumni post in any
 * community they belong to; teens only in their team's (T3); parents and recruiters don't post.
 * Every post waits for review before anyone else sees it (P5). `?communityId=` preselects one.
 */
export default function Compose() {
  const { role } = useRole();
  const params = useLocalSearchParams<{ communityId?: string }>();
  const { state } = useApi(() => api.communities());
  const [picked, setPicked] = useState<string | null>(params.communityId ?? null);
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen eyebrow={role === 'teen' ? 'Team only' : 'Share'} title="New post" back>
      <Async state={state}>
        {(all) => {
          const options = role ? all.filter((x) => canPostIn(role, x)) : [];
          const communityId =
            picked && options.some((x) => x.id === picked)
              ? picked
              : options.length === 1
                ? options[0]!.id
                : null;
          const submit = () => {
            if (!communityId) return setError('Pick a community.');
            setBusy(true);
            setError(null);
            api
              .createPost(communityId, {
                text,
                ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
              })
              .then(
                (p) => router.replace({ pathname: '/home/posts/[id]', params: { id: p.id } }),
                (e: Error) => setError(e.message),
              )
              .finally(() => setBusy(false));
          };
          if (!role || role === 'parent' || role === 'recruiter') {
            return (
              <Gutter>
                <Text color="secondary">
                  You can rally and comment on posts, but posting isn’t available for your account.
                </Text>
              </Gutter>
            );
          }
          return (
            <Gutter gap="lg">
              <View style={styles.block}>
                <Text weight="semibold">Where</Text>
                <CommunityPicker options={options} value={communityId} onChange={setPicked} />
              </View>
              <Input
                label="What’s happening?"
                value={text}
                onChangeText={setText}
                multiline
                numberOfLines={5}
                maxLength={2000}
                textAlignVertical="top"
                placeholder="Share an update with your community"
              />
              <Input
                label="Photo link (optional)"
                value={imageUrl}
                onChangeText={setImageUrl}
                autoCapitalize="none"
                keyboardType="url"
                placeholder="https://"
              />
              <Text variant="small" color="secondary">
                Team Impact reviews every post before others see it. Yours shows as “Waiting for
                review” until then.
              </Text>
              {error && <ErrorText>{error}</ErrorText>}
              <View style={styles.row}>
                {role !== 'teen' && (
                  <Button
                    label="Make it an event"
                    variant="secondary"
                    stretch
                    onPress={() =>
                      router.push(
                        communityId
                          ? { pathname: '/events/new', params: { communityId } }
                          : '/events/new',
                      )
                    }
                  />
                )}
                <Button
                  label={busy ? 'Posting…' : 'Post'}
                  stretch
                  disabled={busy || !text.trim() || !communityId}
                  onPress={submit}
                />
              </View>
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
});
