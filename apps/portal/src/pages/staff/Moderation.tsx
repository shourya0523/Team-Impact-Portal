import { useState } from 'react';
import type {
  ModerationAction,
  ModerationLogEntry,
  ModerationTicket,
  ResolveTicketRequest,
} from '@team-impact/contracts';
import { spacing } from '@team-impact/ui-tokens';
import { api } from '../../api';
import { Actions, Form, FormError, Textarea, useAction } from '../../forms';
import {
  Async,
  Badge,
  type BadgeProps,
  Button,
  formatDate,
  fullName,
  PageHeader,
  Select,
  Sheet,
  Table,
  Text,
} from '../../ui';
import { useApi } from '../../useApi';

const KIND_LABEL: Record<ModerationLogEntry['target']['kind'], string> = {
  post: 'Post',
  comment: 'Comment',
  event: 'Event',
  profile: 'Profile',
  community: 'Community',
  user: 'Account',
};

const REASON_LABEL: Record<ModerationTicket['reasons'][number], string> = {
  bullying: 'Bullying',
  inappropriate_for_kids: 'Not OK for kids',
  private_information: 'Private info',
  impersonation: 'Impersonation',
  spam: 'Spam',
  other: 'Other',
};

const ACTION: Record<ModerationAction, { label: string; tone: BadgeProps['variant'] }> = {
  remove: { label: 'Removed', tone: 'danger' },
  keep: { label: 'Kept', tone: 'neutral' },
  warn: { label: 'Warned', tone: 'warning' },
  suspend: { label: 'Suspended', tone: 'danger' },
  unsuspend: { label: 'Unsuspended', tone: 'success' },
};

type AuthorAction = NonNullable<ResolveTicketRequest['authorAction']> | '';

const SectionTitle = ({ children }: { children: string }) => (
  <Text
    as="h2"
    variant="display"
    size="xs"
    color="brand"
    style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}
  >
    {children}
  </Text>
);

/** Decide one ticket with the author action and a note for the log. */
const ResolveSheet = ({
  ticket,
  onClose,
  onDone,
}: {
  ticket: ModerationTicket | null;
  onClose: () => void;
  onDone: () => void;
}) => {
  const { busy, error, setError, run } = useAction();
  const [resolution, setResolution] = useState<ResolveTicketRequest['resolution']>('remove');
  const [authorAction, setAuthorAction] = useState<AuthorAction>('');
  const [note, setNote] = useState('');

  const close = () => {
    setResolution('remove');
    setAuthorAction('');
    setNote('');
    setError(null);
    onClose();
  };

  const submit = () =>
    ticket &&
    run(
      () =>
        api.staff.resolveTicket(ticket.id, {
          resolution,
          ...(authorAction ? { authorAction } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      () => {
        close();
        onDone();
      },
    );

  return (
    <Sheet open={ticket !== null} title="Decide this report" onClose={close}>
      <Form onSubmit={submit}>
        <Text variant="small" color="secondary">
          {ticket?.preview}
        </Text>
        <Select
          label="The item"
          value={resolution}
          onChange={(e) => setResolution(e.target.value as ResolveTicketRequest['resolution'])}
        >
          <option value="remove">Remove it</option>
          <option value="dismiss">Keep it</option>
        </Select>
        <Select
          label="Its author"
          value={authorAction}
          onChange={(e) => setAuthorAction(e.target.value as AuthorAction)}
        >
          <option value="">No action</option>
          <option value="warn">Send a warning</option>
          <option value="suspend">Suspend their account</option>
        </Select>
        <Textarea
          label="Note for the log"
          maxLength={500}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Text variant="caption" color="muted">
          A warning reaches the author as a notification from Team Impact. A suspended account is
          locked out and its content hidden until you unsuspend it. Staff and a team’s last coach
          can’t be suspended; children have no account.
        </Text>
        <FormError>{error}</FormError>
        <Button type="submit" label="Save decision" disabled={busy} />
      </Form>
    </Sheet>
  );
};

/**
 * S4: reported content as tickets: remove or keep the item, warn or suspend its author. Below,
 * suspended accounts (unsuspend) and the log of every staff moderation action.
 */
export const ModerationPage = () => {
  const tickets = useApi(() => api.staff.tickets());
  const suspended = useApi(() => api.staff.suspendedUsers());
  const log = useApi(() => api.staff.moderationLog());
  const quick = useAction();
  const unsuspend = useAction();
  const [deciding, setDeciding] = useState<ModerationTicket | null>(null);

  const reloadAll = () => {
    tickets.reload();
    suspended.reload();
    log.reload();
  };

  const resolve = (ticket: ModerationTicket, resolution: 'remove' | 'dismiss') =>
    quick.run(() => api.staff.resolveTicket(ticket.id, { resolution }), reloadAll);

  return (
    <>
      <PageHeader
        title="Moderation"
        subtitle="Reports from users and new content waiting for review. Keep approves it."
      />
      <FormError>{quick.error}</FormError>
      <Async state={tickets.state}>
        {(rows) => (
          <Table
            rows={rows}
            rowKey={(t) => t.id}
            empty="No reports. Nice."
            columns={[
              { header: 'Reported', cell: (t) => KIND_LABEL[t.target.kind], width: 110 },
              { header: 'What', cell: (t) => t.preview, width: '30%' },
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
                    <Actions>
                      <Button
                        label="Keep"
                        variant="secondary"
                        size="sm"
                        disabled={quick.busy}
                        onClick={() => resolve(t, 'dismiss')}
                      />
                      <Button
                        label="Remove"
                        size="sm"
                        disabled={quick.busy}
                        onClick={() => resolve(t, 'remove')}
                      />
                      <Button
                        label="Warn or suspend…"
                        variant="quiet"
                        size="sm"
                        disabled={quick.busy}
                        onClick={() => setDeciding(t)}
                      />
                    </Actions>
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

      <SectionTitle>Suspended accounts</SectionTitle>
      <FormError>{unsuspend.error}</FormError>
      <Async state={suspended.state}>
        {(rows) => (
          <Table
            rows={rows}
            rowKey={(s) => s.user.id}
            empty="No one is suspended."
            columns={[
              { header: 'Account', cell: (s) => fullName(s.user), width: '22%' },
              { header: 'Reason', cell: (s) => s.reason ?? '' },
              { header: 'By', cell: (s) => fullName(s.suspendedBy) },
              { header: 'Since', cell: (s) => formatDate(s.suspendedAt) },
              {
                header: 'Access',
                align: 'right',
                cell: (s) => (
                  <Button
                    label="Unsuspend"
                    variant="secondary"
                    size="sm"
                    disabled={unsuspend.busy}
                    onClick={() =>
                      unsuspend.run(() => api.staff.unsuspendUser(s.user.id), reloadAll)
                    }
                  />
                ),
              },
            ]}
          />
        )}
      </Async>

      <SectionTitle>Action log</SectionTitle>
      <Async state={log.state}>
        {(rows) => (
          <Table
            rows={rows}
            rowKey={(e) => e.id}
            empty="No actions yet."
            columns={[
              { header: 'When', cell: (e) => formatDate(e.createdAt), width: 130 },
              { header: 'Who', cell: (e) => fullName(e.actor) },
              {
                header: 'What',
                cell: (e) => (
                  <Badge variant={ACTION[e.action].tone} label={ACTION[e.action].label} />
                ),
              },
              {
                header: 'Target',
                cell: (e) => `${KIND_LABEL[e.target.kind]}: ${e.target.label}`,
                width: '34%',
              },
              { header: 'Note', cell: (e) => e.note ?? '' },
            ]}
          />
        )}
      </Async>

      <ResolveSheet ticket={deciding} onClose={() => setDeciding(null)} onDone={reloadAll} />
    </>
  );
};
