import { useState } from 'react';
import { spacing } from '@team-impact/ui-tokens';
import { api } from '../../api';
import { Checkbox, Form, FormError, Textarea, useAction } from '../../forms';
import { Async, Button, Card, formatDate, PageHeader, Table, Text } from '../../ui';
import { useApi } from '../../useApi';

/**
 * S1: Team Impact's own voice. Announcements go to everyone in Team Impact's community, labelled as
 * from Team Impact. Staff wrote them, so they skip the review queue.
 */
export const AnnouncementsPage = () => {
  const posted = useApi(() => api.staff.announcements());
  const { busy, error, run } = useAction();
  const [text, setText] = useState('');
  const [sendPush, setSendPush] = useState(true);

  const publish = () =>
    run(
      () => api.staff.announce({ text, sendPush }),
      () => {
        setText('');
        posted.reload();
      },
    );

  return (
    <>
      <PageHeader title="Announcements" subtitle="Posted as Team IMPACT, straight into the feed." />
      <Card style={{ padding: spacing.lg, marginBottom: spacing.xl }}>
        <Form onSubmit={publish}>
          <Text color="secondary">
            Goes to everyone on Team Impact, including recruiters, parents and teens.
          </Text>
          <Textarea
            label="Announcement"
            required
            minLength={10}
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Checkbox
            label="Also send a push notification"
            checked={sendPush}
            onChange={setSendPush}
          />
          <FormError>{error}</FormError>
          <div>
            <Button type="submit" label="Post announcement" disabled={busy} />
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
            empty="No announcements yet."
            columns={[
              { header: 'Announcement', cell: (p) => p.text, width: '55%' },
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
