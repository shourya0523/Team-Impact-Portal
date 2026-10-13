import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { canCommentIn, type Comment, type Post } from '@team-impact/contracts';
import { colors, radius, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { HeldNote, Rally } from '@/components/activity';
import { ROLE_LABEL, shortDate } from '@/components/format';
import { Async, ErrorText, Gutter, Screen, SectionLabel } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { Avatar, Badge, Button, Card, Input, Text } from '@/ui';

const PHOTO = 220;

const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`;

function Byline({ who, when }: { who: Post['author']; when: string }) {
  return (
    <View style={styles.byline}>
      <Avatar name={fullName(who)} role={who.role} />
      <View style={styles.grow}>
        <Text weight="semibold">{fullName(who)}</Text>
        <Text variant="caption" weight="medium" color="muted">
          {ROLE_LABEL[who.role]} · {shortDate(when)}
        </Text>
      </View>
    </View>
  );
}

function CommentRow({ c }: { c: Comment }) {
  return (
    <Card>
      <Byline who={c.author} when={c.createdAt} />
      {c.moderation !== 'approved' && <HeldNote what="comment" />}
      <Text>{c.text}</Text>
    </Card>
  );
}

/**
 * "/home/posts/[id]": one post, its comments, Rally, and a comment box. Comments wait for review
 * like posts. Recruiters don't comment; teens comment only inside their team community.
 */
export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role } = useRole();
  const post = useApi(() => api.getPost(id), [id]);
  const comments = useApi(() => api.comments(id), [id]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = () => {
    setBusy(true);
    setError(null);
    api
      .addComment(id, draft)
      .then(
        () => {
          setDraft('');
          comments.reload();
        },
        (e: Error) => setError(e.message),
      )
      .finally(() => setBusy(false));
  };

  return (
    <Screen eyebrow="Post" title="Conversation" back>
      <Async state={post.state}>
        {(p) => {
          const held = p.moderation !== 'approved';
          const canComment = !!role && !held && canCommentIn(role, p.community.kind);
          return (
            <>
              <Gutter>
                <Card>
                  {p.kind === 'announcement' ? (
                    <Badge label="Team IMPACT announcement" variant="brand" icon="megaphone" caps />
                  ) : (
                    <Byline who={p.author} when={p.createdAt} />
                  )}
                  <Text variant="caption" weight="medium" color="muted">
                    in {p.community.name}
                  </Text>
                  {held && <HeldNote what="post" />}
                  <Text>
                    {p.kind === 'opportunity'
                      ? `${p.opportunity.title} at ${p.opportunity.company.name}`
                      : p.text}
                  </Text>
                  {p.imageUrl && (
                    <Image
                      source={{ uri: p.imageUrl }}
                      accessibilityLabel="Photo with the post"
                      style={styles.photo}
                    />
                  )}
                  <View style={styles.actions}>
                    {role !== 'recruiter' && <Rally post={p} />}
                    <Button
                      label="Report"
                      variant="secondary"
                      size="sm"
                      onPress={() =>
                        router.push({ pathname: '/home/posts/report', params: { id: p.id } })
                      }
                    />
                  </View>
                </Card>
              </Gutter>
              <SectionLabel>Comments</SectionLabel>
              <Gutter>
                <Async state={comments.state}>
                  {(list) =>
                    list.length ? (
                      list.map((c) => <CommentRow key={c.id} c={c} />)
                    ) : (
                      <Text variant="small" color="secondary">
                        No comments yet.
                      </Text>
                    )
                  }
                </Async>
                {canComment && (
                  <View style={styles.box}>
                    <Input
                      label="Add a comment"
                      value={draft}
                      onChangeText={setDraft}
                      multiline
                      maxLength={1000}
                      textAlignVertical="top"
                    />
                    {error && <ErrorText>{error}</ErrorText>}
                    <Button
                      label={busy ? 'Sending…' : 'Comment'}
                      variant="brand"
                      disabled={busy || !draft.trim()}
                      onPress={send}
                    />
                  </View>
                )}
              </Gutter>
            </>
          );
        }}
      </Async>
    </Screen>
  );
}

const styles = StyleSheet.create({
  byline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  photo: {
    width: '100%',
    height: PHOTO,
    borderRadius: radius.lg,
    backgroundColor: colors.lineSoft,
  },
  box: { gap: spacing.sm, marginTop: spacing.sm },
});
