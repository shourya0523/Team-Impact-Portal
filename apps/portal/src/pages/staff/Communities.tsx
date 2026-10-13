import { useState } from 'react';
import type { Community, CommunityKind, StaffCommunity } from '@team-impact/contracts';
import { colors, fontWeight, spacing } from '@team-impact/ui-tokens';
import { api } from '../../api';
import { Actions, Form, FormError, useAction } from '../../forms';
import { useSession } from '../../session';
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

const KIND: Record<CommunityKind, { label: string; tone: BadgeProps['variant'] }> = {
  team: { label: 'Team', tone: 'info' },
  team_impact: { label: 'Team Impact', tone: 'info' },
  medical: { label: 'Medical', tone: 'warning' },
  interest: { label: 'Interest', tone: 'neutral' },
};

/**
 * S4, S10: every community. Only open interest communities can be marked official, which makes them a
 * recruiter filter. Medical ones show a member count but never who's in them. The identity search
 * log sits underneath while the flag is on.
 */
export const CommunitiesPage = () => {
  const { flags } = useSession();
  const communities = useApi(() => api.staff.communities());
  const log = useApi(() => api.staff.identitySearches());

  const toggle = (row: StaffCommunity, official: boolean) =>
    api.staff.setOfficial(row.community.id, official).then(communities.reload);

  // S10: merge duplicates of the same kind, or remove one that breaks the rules.
  const [merging, setMerging] = useState<Community | null>(null);
  const [into, setInto] = useState('');
  const merge = useAction();
  const remove = useAction();
  const userMade = (c: Community) => c.kind === 'interest' || c.kind === 'medical';
  const isPrivate = (c: Community) => (c.kind === 'interest' || c.kind === 'medical') && c.private;

  return (
    <>
      <PageHeader
        title="Communities"
        subtitle="Mark interest communities official to make them recruiter filters."
      />
      <Async state={communities.state}>
        {(rows) => (
          <Table
            rows={rows}
            rowKey={(r) => r.community.id}
            columns={[
              {
                header: 'Community',
                cell: ({ community: c }) => (
                  <span style={{ fontWeight: fontWeight.semibold, color: colors.brand }}>
                    {c.name}
                  </span>
                ),
              },
              {
                header: 'Kind',
                cell: ({ community: c }) => (
                  <span style={{ display: 'inline-flex', gap: spacing.xs }}>
                    <Badge variant={KIND[c.kind].tone} label={KIND[c.kind].label} />
                    {(c.kind === 'interest' || c.kind === 'medical') && c.private && (
                      <Badge variant="neutral" label="Private" />
                    )}
                  </span>
                ),
              },
              { header: 'Members', cell: (r) => r.community.memberCount, align: 'right' },
              {
                header: 'Findable by recruiters',
                align: 'right',
                cell: (r) => r.recruiterSearchOptInCount ?? '—',
              },
              {
                header: 'Moderation',
                cell: ({ community: c }) =>
                  c.moderation === 'approved' ? (
                    <Badge variant="success" label="Approved" />
                  ) : c.moderation === 'in_review' ? (
                    <Badge variant="warning" label="In review" />
                  ) : (
                    <Badge variant="danger" label="Removed" />
                  ),
              },
              {
                header: 'Official',
                align: 'right',
                cell: (r) =>
                  r.community.kind === 'interest' && r.community.private ? (
                    <Text as="span" variant="caption" color="muted">
                      Private: can’t be official
                    </Text>
                  ) : r.community.kind === 'interest' && r.community.moderation !== 'approved' ? (
                    <Text as="span" variant="caption" color="muted">
                      Approve it first
                    </Text>
                  ) : r.community.kind === 'interest' ? (
                    <Button
                      label={r.community.official ? 'Official' : 'Mark official'}
                      variant={r.community.official ? 'primary' : 'secondary'}
                      size="sm"
                      aria-pressed={r.community.official}
                      onClick={() =>
                        r.community.kind === 'interest' && toggle(r, !r.community.official)
                      }
                    />
                  ) : (
                    <Text as="span" variant="caption" color="muted">
                      Can’t be official
                    </Text>
                  ),
              },
              {
                header: 'Actions',
                align: 'right',
                cell: ({ community: c }) =>
                  userMade(c) && c.moderation !== 'removed' ? (
                    <Actions>
                      <Button
                        label="Merge…"
                        variant="quiet"
                        size="sm"
                        onClick={() => {
                          merge.setError(null);
                          setInto('');
                          setMerging(c);
                        }}
                      />
                      <Button
                        label="Remove"
                        variant="secondary"
                        size="sm"
                        disabled={remove.busy}
                        onClick={() =>
                          window.confirm(`Remove ${c.name}? Its posts and events go with it.`) &&
                          remove.run(() => api.staff.removeCommunity(c.id), communities.reload)
                        }
                      />
                    </Actions>
                  ) : null,
              },
            ]}
          />
        )}
      </Async>
      <FormError>{remove.error}</FormError>

      <Sheet open={!!merging} title="Merge a duplicate" onClose={() => setMerging(null)}>
        {merging && communities.state.status === 'ready' && (
          <Form
            onSubmit={() =>
              merge.run(
                () => api.staff.mergeCommunity(merging.id, into),
                () => {
                  setMerging(null);
                  communities.reload();
                },
              )
            }
          >
            <Text variant="small" color="secondary">
              {merging.name}’s members, posts and events move into the community you pick, then{' '}
              {merging.name} is removed. Only the same kind can merge; a private community only
              merges into another private one. Nobody becomes findable by recruiters through a
              merge.
            </Text>
            <Select
              label="Keep this community"
              required
              value={into}
              onChange={(e) => setInto(e.target.value)}
            >
              <option value="">Pick one</option>
              {communities.state.data
                .map((r) => r.community)
                .filter(
                  (c) =>
                    c.id !== merging.id &&
                    c.kind === merging.kind &&
                    c.moderation !== 'removed' &&
                    (!isPrivate(merging) || isPrivate(c)),
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
            <FormError>{merge.error}</FormError>
            <Button type="submit" label="Merge" disabled={merge.busy || !into} />
          </Form>
        )}
      </Sheet>

      {flags?.identitySearch && (
        <section style={{ marginTop: spacing.xl }}>
          <Text
            as="h2"
            variant="display"
            size="xs"
            color="brand"
            style={{ marginBottom: spacing.sm }}
          >
            Identity search log
          </Text>
          <Text variant="small" color="muted" style={{ marginBottom: spacing.md }}>
            Every recruiter search filtered by an official community.
          </Text>
          <Async state={log.state}>
            {(entries) => (
              <Table
                rows={entries}
                rowKey={(e) => e.id}
                empty="No identity searches yet."
                columns={[
                  { header: 'Recruiter', cell: (e) => fullName(e.recruiter) },
                  { header: 'Company', cell: (e) => e.company.name },
                  { header: 'Community', cell: (e) => e.community.name },
                  { header: 'When', cell: (e) => `${formatDate(e.searchedAt)}` },
                ]}
              />
            )}
          </Async>
        </section>
      )}
    </>
  );
};
