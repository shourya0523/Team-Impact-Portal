import { api } from '../../api';
import { Async, Badge, brand, formatDate, PageHeader, Table } from '../../ui';
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
                cell: (c) => <span style={{ fontWeight: 700, color: brand.navy }}>{c.name}</span>,
              },
              { header: 'Email domains', cell: (c) => c.domains.join(', ') },
              { header: 'Recruiters', cell: (c) => c.recruiterCount, align: 'right' },
              {
                header: 'Status',
                cell: (c) =>
                  c.status === 'active' ? (
                    <Badge tone="good">Active</Badge>
                  ) : (
                    <Badge tone="danger">Suspended</Badge>
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
