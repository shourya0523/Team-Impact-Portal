import type { TeamStatus } from '@team-impact/contracts';
import { api } from '../../api';
import { Async, Badge, brand, formatDate, PageHeader, Table, Tile } from '../../ui';
import { useApi } from '../../useApi';

const STATUS: Record<TeamStatus, { label: string; tone: 'good' | 'warn' | 'neutral' }> = {
  live: { label: 'Live', tone: 'good' },
  invited: { label: 'Waiting on coach', tone: 'warn' },
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
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                    <Tile
                      text={`${t.gender === 'women' ? 'W' : 'M'}${t.sport[0] ?? ''}`}
                      color={t.color ?? brand.navy}
                    />
                    <span style={{ fontWeight: 700, color: brand.navy }}>{t.name}</span>
                  </span>
                ),
              },
              { header: 'College', cell: (t) => t.college.name },
              { header: 'Sport', cell: (t) => `${t.sport} · Division ${t.division}` },
              { header: 'Members', cell: (t) => t.memberCount, align: 'right' },
              {
                header: 'Status',
                cell: (t) => <Badge tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Badge>,
              },
              { header: 'Created', cell: (t) => formatDate(t.createdAt) },
            ]}
          />
        )}
      </Async>
    </>
  );
};
