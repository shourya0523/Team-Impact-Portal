import { useState } from 'react';
import { canPostIn } from '@team-impact/contracts';
import { spacing } from '@team-impact/ui-tokens';
import { api } from '../../api';
import { Form, FormError, Textarea, useAction } from '../../forms';
import { Async, Button, Card, formatDate, PageHeader, Table, Text } from '../../ui';
import { useApi } from '../../useApi';
import { CommunitySelect, useCommunityChoice } from './CommunitySelect';

/**
 * S1: a plain post into a community staff belong to, under the staff member's name with a Staff
 * badge. Staff wrote it, so it publishes at once; unlike an announcement, it notifies nobody.
 */
export const PostsPage = () => {
  const posted = useApi(() => api.staff.posts());
  const community = useCommunityChoice((c) => canPostIn('staff', c));
  const { busy, error, run } = useAction();
  const [text, setText] = useState('');
  const [sent, setSent] = useState<string | null>(null);

  const publish = () => {
    const c = community.chosen;
    if (!c) return;
    setSent(null);
    return run(
      () => api.staff.createPost(c.id, { text }),
      () => {
        setText('');
        setSent(`Posted to ${c.name}.`);
        posted.reload();
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Posts"
        subtitle="Posted under your name, with a Staff badge, into a community you belong to. Nobody is notified."
      />
      <Card style={{ padding: spacing.lg, marginBottom: spacing.xl }}>
        <Form onSubmit={publish}>
          <CommunitySelect {...community} />
          <Textarea
            label="Post"
            required
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <FormError>{error}</FormError>
          {sent && (
            <Text role="status" variant="small" color="secondary">
              {sent}
            </Text>
          )}
          <div>
            <Button type="submit" label="Post" disabled={busy || !community.chosen} />
          </div>
        </Form>
      </Card>
      <Text as="h2" variant="display" size="xs" color="brand" style={{ marginBottom: spacing.sm }}>
        Posted
      </Text>
      <Async state={posted.state}>
        {(posts) => (
          <Table
            rows={posts}
            rowKey={(p) => p.id}
            empty="No posts yet."
            columns={[
              { header: 'Post', cell: (p) => p.text, width: '55%' },
              { header: 'Community', cell: (p) => p.community.name },
              { header: 'Rallies', cell: (p) => p.likeCount, align: 'right' },
              { header: 'Posted', cell: (p) => formatDate(p.createdAt) },
            ]}
          />
        )}
      </Async>
    </>
  );
};
