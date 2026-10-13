import { colors, fontWeight } from '@team-impact/ui-tokens';
import { api } from '../../api';
import { Async, Badge, formatDate, PageHeader, Table } from '../../ui';
import { useApi } from '../../useApi';

/** S3 / R13: partner companies, their email domains and recruiters. Suspend comes next. */
export const CompaniesPage = () => {
  const { state } = useApi(() => api.staff.companies());
  return (
    <>
      <PageHeader
        title="Companies"
        subtitle="Anyone who verifies an address on a company's domain gets recruiter access."
      />
      <Async state={state}>
        {(companies) => (
          <Table
            rows={companies}
            rowKey={(c) => c.id}
            columns={[
              {
                header: 'Company',
                cell: (c) => (
                  <span style={{ fontWeight: fontWeight.semibold, color: colors.brand }}>
                    {c.name}
                  </span>
                ),
              },
              { header: 'Email domains', cell: (c) => c.domains.join(', ') },
              { header: 'Recruiters', cell: (c) => c.recruiterCount, align: 'right' },
              {
                header: 'Status',
                cell: (c) =>
                  c.status === 'active' ? (
                    <Badge variant="success" label="Active" />
                  ) : (
                    <Badge variant="danger" label="Suspended" />
                  ),
              },
              { header: 'Onboarded', cell: (c) => formatDate(c.createdAt) },
            ]}
          />
        )}
      </Async>
    </>
  );
};
