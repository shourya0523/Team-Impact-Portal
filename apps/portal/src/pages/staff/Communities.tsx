import type { CommunityKind, StaffCommunity } from '@team-impact/contracts';
import { fontSize, spacing } from '@team-impact/ui-tokens';
import { api } from '../../api';
import { useSession } from '../../session';
import { Async, Badge, brand, button, formatDate, fullName, PageHeader, Table } from '../../ui';
import { useApi } from '../../useApi';

const KIND: Record<CommunityKind, { label: string; tone: 'info' | 'neutral' | 'warn' | 'good' }> = {
  team: { label: 'Team', tone: 'info' },
  team_impact: { label: 'Team Impact', tone: 'info' },
  medical: { label: 'Medical', tone: 'warn' },
  interest: { label: 'Interest', tone: 'neutral' },
};

/**
 * S4, S10: every community. Only interest communities can be marked official, which makes them a
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
                  <span style={{ fontWeight: 700, color: brand.navy }}>{c.name}</span>
                ),
              },
              {
                header: 'Kind',
                cell: ({ community: c }) => (
                  <Badge tone={KIND[c.kind].tone}>{KIND[c.kind].label}</Badge>
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
                    <Badge tone="good">Approved</Badge>
                  ) : c.moderation === 'in_review' ? (
                    <Badge tone="warn">In review</Badge>
                  ) : (
                    <Badge tone="danger">Removed</Badge>
                  ),
              },
              {
                header: 'Official',
                align: 'right',
                cell: (r) =>
                  r.community.kind === 'interest' && r.community.moderation !== 'approved' ? (
                    <span style={{ color: brand.muted, fontSize: 12 }}>Approve it first</span>
                  ) : r.community.kind === 'interest' ? (
                    <button
                      type="button"
                      aria-pressed={r.community.official}
                      style={button(r.community.official ? 'primary' : 'secondary')}
                      onClick={() =>
                        r.community.kind === 'interest' && toggle(r, !r.community.official)
                      }
                    >
                      {r.community.official ? 'Official' : 'Mark official'}
                    </button>
                  ) : (
                    <span style={{ color: brand.muted, fontSize: 12 }}>Can’t be official</span>
                  ),
              },
            ]}
          />
        )}
      </Async>

      {flags?.identitySearch && (
        <section style={{ marginTop: spacing.xl }}>
          <h2 style={{ fontSize: fontSize.lg, color: brand.navy, margin: `0 0 ${spacing.sm}px` }}>
            Identity search log
          </h2>
          <p style={{ margin: `0 0 ${spacing.md}px`, color: brand.muted, fontSize: fontSize.sm }}>
            Every recruiter search filtered by an official community.
          </p>
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
