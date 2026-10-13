import { useState } from 'react';
import { colors, fontWeight } from '@team-impact/ui-tokens';
import { api } from '../../api';
import { Form, FormError, useAction } from '../../forms';
import { Async, Badge, Button, formatDate, Input, PageHeader, Sheet, Table, Text } from '../../ui';
import { useApi } from '../../useApi';

/** S3 / R13: partner companies, their email domains and recruiters; onboard and suspend. */
export const CompaniesPage = () => {
  const { state, reload } = useApi(() => api.staff.companies());
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [domains, setDomains] = useState('');
  const create = useAction();
  const status = useAction();

  const add = () =>
    create.run(
      () =>
        api.staff.createCompany({
          name,
          domains: domains
            .split(/[\s,]+/)
            .map((d) => d.trim())
            .filter(Boolean),
        }),
      () => {
        setAdding(false);
        setName('');
        setDomains('');
        reload();
      },
    );

  return (
    <>
      <PageHeader
        title="Companies"
        subtitle="Anyone who verifies an address on a company's domain gets recruiter access."
        action={<Button label="Add company" onClick={() => setAdding(true)} />}
      />
      <FormError>{status.error}</FormError>
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
              {
                header: 'Access',
                align: 'right',
                cell: (c) =>
                  c.status === 'active' ? (
                    <Button
                      label="Suspend"
                      variant="secondary"
                      size="sm"
                      disabled={status.busy}
                      onClick={() => status.run(() => api.staff.suspendCompany(c.id), reload)}
                    />
                  ) : (
                    <Button
                      label="Restore"
                      variant="secondary"
                      size="sm"
                      disabled={status.busy}
                      onClick={() => status.run(() => api.staff.restoreCompany(c.id), reload)}
                    />
                  ),
              },
            ]}
          />
        )}
      </Async>
      <Sheet open={adding} title="Add company" onClose={() => setAdding(false)}>
        <Form onSubmit={add}>
          <Input
            label="Company name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Email domains"
            placeholder="northbeam.com, nb.co"
            required
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
          />
          <Text variant="caption" color="muted">
            Personal email domains such as gmail.com are refused. Suspending a company locks its
            recruiters out until you restore it; their lists and notes are kept.
          </Text>
          <FormError>{create.error}</FormError>
          <Button type="submit" label="Add company" disabled={create.busy} />
        </Form>
      </Sheet>
    </>
  );
};
