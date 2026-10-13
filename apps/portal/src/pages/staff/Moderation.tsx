import { useState } from 'react';
import type { ModerationTicket } from '@team-impact/contracts';
import { spacing } from '@team-impact/ui-tokens';
import { api } from '../../api';
import { Async, Badge, Button, formatDate, PageHeader, Table } from '../../ui';
import { useApi } from '../../useApi';

const KIND_LABEL: Record<ModerationTicket['target']['kind'], string> = {
  post: 'Post',
  comment: 'Comment',
  event: 'Event',
  profile: 'Profile',
  community: 'Community',
};

const REASON_LABEL: Record<ModerationTicket['reasons'][number], string> = {
  bullying: 'Bullying',
  inappropriate_for_kids: 'Not OK for kids',
  private_information: 'Private info',
  impersonation: 'Impersonation',
  spam: 'Spam',
  other: 'Other',
};

/** S4: reported content as tickets. Removing takes the item down everywhere. */
export const ModerationPage = () => {
  const { state, reload } = useApi(() => api.staff.tickets());
  const [busy, setBusy] = useState<string | null>(null);

  const resolve = (ticket: ModerationTicket, resolution: 'remove' | 'dismiss') => {
    setBusy(ticket.id);
    api.staff
      .resolveTicket(ticket.id, { resolution })
      .then(reload)
      .finally(() => setBusy(null));
  };

  return (
    <>
      <PageHeader
        title="Moderation"
        subtitle="Reports from users and new content waiting for review. Keep approves it."
      />
      <Async state={state}>
        {(tickets) => (
          <Table
            rows={tickets}
            rowKey={(t) => t.id}
            empty="No reports. Nice."
            columns={[
              { header: 'Reported', cell: (t) => KIND_LABEL[t.target.kind], width: 110 },
              { header: 'What', cell: (t) => t.preview, width: '34%' },
              {
                header: 'Why',
                // New posts, comments, events and communities wait here with no reports.
                cell: (t) =>
                  t.reasons.length
                    ? t.reasons.map((r) => REASON_LABEL[r]).join(', ')
                    : 'New, waiting for review',
              },
              { header: 'Reports', cell: (t) => t.reportCount, align: 'right' },
              { header: 'Opened', cell: (t) => formatDate(t.createdAt) },
              {
                header: 'Status',
                align: 'right',
                cell: (t) =>
                  t.status === 'open' ? (
                    <span style={{ display: 'inline-flex', gap: spacing.sm }}>
                      <Button
                        label="Keep"
                        variant="secondary"
                        size="sm"
                        disabled={busy === t.id}
                        onClick={() => resolve(t, 'dismiss')}
                      />
                      <Button
                        label="Remove"
                        size="sm"
                        disabled={busy === t.id}
                        onClick={() => resolve(t, 'remove')}
                      />
                    </span>
                  ) : (
                    <Badge
                      variant={t.resolution === 'remove' ? 'danger' : 'neutral'}
                      label={t.resolution === 'remove' ? 'Removed' : 'Kept'}
                    />
                  ),
              },
            ]}
          />
        )}
      </Async>
    </>
  );
};
