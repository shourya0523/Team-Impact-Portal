import type { Company, Recruiter } from '@team-impact/contracts';
import { colors, fontWeight, spacing } from '@team-impact/ui-tokens';
import { api } from '../../api';
import { Actions, FormError, useAction } from '../../forms';
import { Async, Badge, Button, formatDate, fullName, PageHeader, Table, Text } from '../../ui';
import { useApi } from '../../useApi';

const SectionTitle = ({ children }: { children: string }) => (
  <Text
    as="h2"
    variant="display"
    size="xs"
    color="brand"
    style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}
  >
    {children}
  </Text>
);

/** Approved recruiters grouped under their company, companies A to Z. */
const byCompany = (recruiters: Recruiter[], companies: Company[]) =>
  companies
    .map((c) => ({ company: c, recruiters: recruiters.filter((r) => r.companyId === c.id) }))
    .filter((g) => g.recruiters.length > 0)
    .sort((a, b) => a.company.name.localeCompare(b.company.name));

/**
 * S3 / R13: recruiter sign-ups waiting on staff (approve or decline), and every approved recruiter
 * by company, each with their own suspend and restore. A suspended recruiter is refused everywhere.
 */
export const RecruitersPage = () => {
  const pending = useApi(() => api.staff.recruiterSignUps());
  const approved = useApi(() =>
    Promise.all([api.staff.recruiters(), api.staff.companies()]).then(([r, c]) => byCompany(r, c)),
  );
  const decide = useAction();
  const access = useAction();

  const reloadAll = () => {
    pending.reload();
    approved.reload();
  };

  return (
    <>
      <PageHeader
        title="Recruiters"
        subtitle="Approve recruiters who signed up with a partner company's work email."
      />

      <SectionTitle>Waiting for approval</SectionTitle>
      <FormError>{decide.error}</FormError>
      <Async state={pending.state}>
        {(rows) => (
          <Table
            rows={rows}
            rowKey={(r) => r.id}
            empty="No one is waiting."
            columns={[
              {
                header: 'Name',
                cell: (r) => (
                  <span style={{ fontWeight: fontWeight.semibold, color: colors.brand }}>
                    {fullName(r)}
                  </span>
                ),
              },
              { header: 'Work email', cell: (r) => r.email },
              { header: 'Company', cell: (r) => r.company.name },
              { header: 'Requested', cell: (r) => formatDate(r.requestedAt) },
              {
                header: 'Decision',
                align: 'right',
                cell: (r) => (
                  <Actions>
                    <Button
                      label="Decline"
                      variant="secondary"
                      size="sm"
                      disabled={decide.busy}
                      onClick={() => decide.run(() => api.staff.declineRecruiter(r.id), reloadAll)}
                    />
                    <Button
                      label="Approve"
                      size="sm"
                      disabled={decide.busy}
                      onClick={() => decide.run(() => api.staff.approveRecruiter(r.id), reloadAll)}
                    />
                  </Actions>
                ),
              },
            ]}
          />
        )}
      </Async>

      <SectionTitle>Approved recruiters</SectionTitle>
      <FormError>{access.error}</FormError>
      <Async state={approved.state}>
        {(groups) =>
          groups.length === 0 ? (
            <Text color="muted">No approved recruiters yet.</Text>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
              {groups.map(({ company, recruiters }) => (
                <section
                  key={company.id}
                  aria-label={company.name}
                  style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}
                >
                  <Text as="h3" variant="body" weight="semibold">
                    {company.name}
                    {company.status === 'suspended' && ' (company suspended)'}
                  </Text>
                  <Table
                    rows={recruiters}
                    rowKey={(r) => r.user.id}
                    columns={[
                      { header: 'Name', cell: (r) => fullName(r.user), width: '24%' },
                      { header: 'Work email', cell: (r) => r.email },
                      { header: 'Title', cell: (r) => r.title ?? '' },
                      { header: 'Joined', cell: (r) => formatDate(r.joinedAt) },
                      {
                        header: 'Status',
                        cell: (r) =>
                          r.suspended ? (
                            <Badge variant="danger" label="Suspended" />
                          ) : (
                            <Badge variant="success" label="Active" />
                          ),
                      },
                      {
                        header: 'Access',
                        align: 'right',
                        cell: (r) => (
                          <Button
                            label={r.suspended ? 'Restore' : 'Suspend'}
                            variant="secondary"
                            size="sm"
                            disabled={access.busy}
                            onClick={() =>
                              access.run(
                                () =>
                                  r.suspended
                                    ? api.staff.restoreRecruiter(r.user.id)
                                    : api.staff.suspendRecruiter(r.user.id),
                                approved.reload,
                              )
                            }
                          />
                        ),
                      },
                    ]}
                  />
                </section>
              ))}
            </div>
          )
        }
      </Async>
    </>
  );
};
