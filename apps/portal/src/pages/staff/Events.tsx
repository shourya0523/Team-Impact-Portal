import { useState } from 'react';
import { canCreateEventIn } from '@team-impact/contracts';
import { spacing } from '@team-impact/ui-tokens';
import { api } from '../../api';
import { Form, FormError, Textarea, useAction } from '../../forms';
import { Async, Button, Card, formatDate, Input, PageHeader, Table, Text } from '../../ui';
import { useApi } from '../../useApi';
import { CommunitySelect, useCommunityChoice } from './CommunitySelect';

const EMPTY = { title: '', startsAt: '', endsAt: '', location: '', details: '' };

/** A `datetime-local` value ("2026-12-05T18:00", the staff member's time) as an ISO timestamp. */
const iso = (local: string) => new Date(local).toISOString();

/**
 * S1: an event from Team Impact, into a community staff belong to. Staff wrote it, so it publishes
 * at once and tells the community's members, like any approved event. Staff are RSVP'd going.
 */
export const EventsPage = () => {
  const hosted = useApi(() => api.staff.events());
  const community = useCommunityChoice((c) => canCreateEventIn('staff', c));
  const { busy, error, run } = useAction();
  const [form, setForm] = useState(EMPTY);
  const [sent, setSent] = useState<string | null>(null);
  const set = (field: keyof typeof EMPTY) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const publish = () => {
    const c = community.chosen;
    if (!c) return;
    setSent(null);
    return run(
      () =>
        api.staff.createEvent(c.id, {
          title: form.title,
          startsAt: iso(form.startsAt),
          ...(form.endsAt ? { endsAt: iso(form.endsAt) } : {}),
          location: form.location,
          ...(form.details.trim() ? { details: form.details } : {}),
        }),
      () => {
        setForm(EMPTY);
        setSent(`Event added to ${c.name}.`);
        hosted.reload();
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Events"
        subtitle="Hosted by Team IMPACT in a community you belong to; its members are told."
      />
      <Card style={{ padding: spacing.lg, marginBottom: spacing.xl }}>
        <Form onSubmit={publish}>
          <CommunitySelect {...community} />
          <Input
            label="Title"
            required
            maxLength={120}
            value={form.title}
            onChange={(e) => set('title')(e.target.value)}
          />
          <Input
            label="Starts"
            type="datetime-local"
            required
            value={form.startsAt}
            onChange={(e) => set('startsAt')(e.target.value)}
          />
          <Input
            label="Ends (optional)"
            type="datetime-local"
            value={form.endsAt}
            onChange={(e) => set('endsAt')(e.target.value)}
          />
          <Input
            label="Where"
            required
            maxLength={200}
            value={form.location}
            onChange={(e) => set('location')(e.target.value)}
          />
          <Textarea
            label="Details (optional)"
            maxLength={2000}
            value={form.details}
            onChange={(e) => set('details')(e.target.value)}
          />
          <FormError>{error}</FormError>
          {sent && (
            <Text role="status" variant="small" color="secondary">
              {sent}
            </Text>
          )}
          <div>
            <Button type="submit" label="Add event" disabled={busy || !community.chosen} />
          </div>
        </Form>
      </Card>
      <Text as="h2" variant="display" size="xs" color="brand" style={{ marginBottom: spacing.sm }}>
        Hosted
      </Text>
      <Async state={hosted.state}>
        {(events) => (
          <Table
            rows={events}
            rowKey={(e) => e.id}
            empty="No events yet."
            columns={[
              { header: 'Event', cell: (e) => e.title, width: '40%' },
              { header: 'Community', cell: (e) => e.community.name },
              { header: 'Starts', cell: (e) => formatDate(e.startsAt) },
              { header: 'Going', cell: (e) => e.goingCount, align: 'right' },
            ]}
          />
        )}
      </Async>
    </>
  );
};
