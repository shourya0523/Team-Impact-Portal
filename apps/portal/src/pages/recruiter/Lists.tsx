import { Link } from 'react-router';
import { colors, fontWeight, spacing } from '@team-impact/ui-tokens';
import { api } from '../../api';
import { Async, formatDate, fullName, PageHeader, Table } from '../../ui';
import { useApi } from '../../useApi';

/** The list's own colour dot (runtime data, chosen by the recruiter). */
const DOT = spacing.md;

/** R6: the recruiter's own lists and the ones colleagues shared with them. */
export const ListsPage = () => {
  const { state } = useApi(() => api.lists());
  return (
    <>
      <PageHeader
        title="Lists"
        subtitle="Your shortlists and the ones colleagues shared with you."
      />
      <Async state={state}>
        {(lists) => (
          <Table
            rows={lists}
            rowKey={(l) => l.id}
            empty="No lists yet. Save athletes from search to start one."
            columns={[
              {
                header: 'List',
                cell: (l) => (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.sm }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: DOT,
                        height: DOT,
                        borderRadius: DOT / 2,
                        background: l.color,
                      }}
                    />
                    <Link
                      to={`/lists/${l.id}`}
                      style={{ color: colors.brand, fontWeight: fontWeight.semibold }}
                    >
                      {l.name}
                    </Link>
                  </span>
                ),
              },
              { header: 'Note', cell: (l) => l.note ?? '—' },
              { header: 'Owner', cell: (l) => fullName(l.owner) },
              {
                header: 'Shared with',
                cell: (l) => l.sharedWith.map(fullName).join(', ') || 'Only you',
              },
              { header: 'Athletes', cell: (l) => l.athleteCount, align: 'right' },
              { header: 'Updated', cell: (l) => formatDate(l.updatedAt) },
            ]}
          />
        )}
      </Async>
    </>
  );
};
