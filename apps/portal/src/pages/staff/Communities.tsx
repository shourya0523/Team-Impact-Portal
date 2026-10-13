import type { CommunityKind, StaffCommunity } from '@team-impact/contracts';
import { colors, fontWeight, spacing } from '@team-impact/ui-tokens';
import { api } from '../../api';
import { useSession } from '../../session';
import {
  Async,
  Badge,
  type BadgeProps,
  Button,
  formatDate,
  fullName,
  PageHeader,
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
            ]}
          />
        )}
      </Async>

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
