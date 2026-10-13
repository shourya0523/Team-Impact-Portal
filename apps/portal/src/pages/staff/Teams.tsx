import type { TeamStatus } from '@team-impact/contracts';
import { colors, fontWeight, spacing } from '@team-impact/ui-tokens';
import { api } from '../../api';
import { Async, Badge, type BadgeProps, formatDate, PageHeader, Table, Tile } from '../../ui';
import { useApi } from '../../useApi';

const STATUS: Record<TeamStatus, { label: string; tone: BadgeProps['variant'] }> = {
  live: { label: 'Live', tone: 'success' },
  invited: { label: 'Waiting on coach', tone: 'warning' },
  archived: { label: 'Archived', tone: 'neutral' },
};

/** S2, S7, S8: every team and where it stands. Create, edit and coach management come next. */
export const TeamsPage = () => {
  const { state } = useApi(() => api.staff.teams());
  return (
    <>
      <PageHeader title="Teams" subtitle="Teams Team Impact has set up, by college." />
      <Async state={state}>
        {(teams) => (
          <Table
            rows={teams}
            rowKey={(t) => t.id}
            columns={[
              {
                header: 'Team',
                cell: (t) => (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.sm }}>
                    <Tile
                      text={`${t.gender === 'women' ? 'W' : 'M'}${t.sport[0] ?? ''}`}
                      teamColor={t.color}
                    />
                    <span style={{ fontWeight: fontWeight.semibold, color: colors.brand }}>
                      {t.name}
                    </span>
                  </span>
                ),
              },
              { header: 'College', cell: (t) => t.college.name },
              { header: 'Sport', cell: (t) => `${t.sport} · Division ${t.division}` },
              { header: 'Members', cell: (t) => t.memberCount, align: 'right' },
              {
                header: 'Status',
                cell: (t) => (
                  <Badge variant={STATUS[t.status].tone} label={STATUS[t.status].label} />
                ),
              },
              { header: 'Created', cell: (t) => formatDate(t.createdAt) },
            ]}
          />
        )}
      </Async>
    </>
  );
};
