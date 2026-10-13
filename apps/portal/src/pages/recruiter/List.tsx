import { Link, useParams } from 'react-router';
import { colors, fontWeight, spacing, typography } from '@team-impact/ui-tokens';
import { api } from '../../api';
import { Async, formatDate, fullName, PageHeader, Table, Tile } from '../../ui';
import { useApi } from '../../useApi';

/** R6: one list's athletes, who added them, and the company's latest note on each. */
export const ListPage = () => {
  const { id = '' } = useParams();
  const { state } = useApi(() => api.list(id), [id]);
  return (
    <>
      <Link
        to="/lists"
        style={{
          color: colors.brand,
          fontSize: typography.small.fontSize,
          fontWeight: fontWeight.semibold,
        }}
      >
        ← All lists
      </Link>
      <div style={{ height: spacing.md }} />
      <Async state={state}>
        {(list) => (
          <>
            <PageHeader
              title={list.name}
              subtitle={`${list.note ?? 'No note'} · Owner ${fullName(list.owner)}${
                list.sharedWith.length
                  ? ` · Shared with ${list.sharedWith.map(fullName).join(', ')}`
                  : ''
              }`}
            />
            <Table
              rows={list.entries}
              rowKey={(e) => e.card.id}
              empty="No athletes here right now. Athletes who turn recruiting off drop out until they turn it back on."
              columns={[
                {
                  header: 'Athlete',
                  cell: (e) => (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.sm }}>
                      <Tile text={e.card.jerseyNumber ?? '–'} teamColor={e.card.team?.color} />
                      <Link
                        to={`/athletes/${e.card.athleteId}`}
                        style={{ color: colors.brand, fontWeight: fontWeight.semibold }}
                      >
                        {fullName(e.card)}
                      </Link>
                    </span>
                  ),
                },
                { header: 'Team', cell: (e) => e.card.team?.name ?? 'Alumni' },
                { header: 'Major', cell: (e) => e.card.major },
                {
                  header: 'Added',
                  cell: (e) => `${fullName(e.addedBy)}, ${formatDate(e.addedAt)}`,
                },
                { header: 'Latest note', cell: (e) => e.latestNote?.text ?? '—', width: '32%' },
              ]}
            />
          </>
        )}
      </Async>
    </>
  );
};
