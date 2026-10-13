import { useState } from 'react';
import type { ModerationTicket } from '@team-impact/contracts';
import { spacing } from '@team-impact/ui-tokens';
import { api } from '../../api';
import { Async, Badge, button, formatDate, PageHeader, Table } from '../../ui';
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
      <PageHeader title="Moderation" subtitle="Reports from users, oldest open tickets last." />
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
                cell: (t) => t.reasons.map((r) => REASON_LABEL[r]).join(', '),
              },
              { header: 'Reports', cell: (t) => t.reportCount, align: 'right' },
              { header: 'Opened', cell: (t) => formatDate(t.createdAt) },
              {
                header: 'Status',
                align: 'right',
                cell: (t) =>
                  t.status === 'open' ? (
                    <span style={{ display: 'inline-flex', gap: spacing.sm }}>
                      <button
                        type="button"
                        disabled={busy === t.id}
                        style={button('secondary')}
                        onClick={() => resolve(t, 'dismiss')}
                      >
                        Keep
                      </button>
                      <button
                        type="button"
                        disabled={busy === t.id}
                        style={button('primary')}
                        onClick={() => resolve(t, 'remove')}
                      >
                        Remove
                      </button>
                    </span>
                  ) : (
                    <Badge tone={t.resolution === 'remove' ? 'danger' : 'neutral'}>
                      {t.resolution === 'remove' ? 'Removed' : 'Kept'}
                    </Badge>
                  ),
              },
            ]}
          />
        )}
      </Async>
    </>
  );
};
