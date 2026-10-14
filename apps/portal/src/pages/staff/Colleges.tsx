import { useState } from 'react';
import type { College } from '@team-impact/contracts';
import { colors, fontWeight } from '@team-impact/ui-tokens';
import { api } from '../../api';
import { Actions, Form, FormError, useAction } from '../../forms';
import { Async, Button, Input, PageHeader, Select, Sheet, Table, Text } from '../../ui';
import { useApi } from '../../useApi';

type Open = { kind: 'new' } | { kind: 'rename' | 'merge'; college: College } | null;

/** S6: one name per college, so team creation and the join search never split a college. */
export const CollegesPage = () => {
  const colleges = useApi(() => api.staff.colleges());
  const teams = useApi(() => api.staff.teams());
  const [open, setOpen] = useState<Open>(null);
  const [name, setName] = useState('');
  const [into, setInto] = useState('');
  const { busy, error, run, setError } = useAction();

  const show = (next: Open) => {
    setError(null);
    setName(next?.kind === 'rename' ? next.college.name : '');
    setInto('');
    setOpen(next);
  };
  const done = () => {
    setOpen(null);
    colleges.reload();
    teams.reload();
  };
  const teamCount = (id: string) =>
    teams.state.status === 'ready' ? teams.state.data.filter((t) => t.college.id === id).length : 0;

  return (
    <>
      <PageHeader
        title="Colleges"
        subtitle="The managed list staff pick from when creating a team."
        action={<Button label="Add college" onClick={() => show({ kind: 'new' })} />}
      />
      <Async state={colleges.state}>
        {(list) => (
          <>
            <Table
              rows={list}
              rowKey={(c) => c.id}
              columns={[
                {
                  header: 'College',
                  cell: (c) => (
                    <span style={{ fontWeight: fontWeight.semibold, color: colors.brand }}>
                      {c.name}
                    </span>
                  ),
                },
                { header: 'Teams', cell: (c) => teamCount(c.id), align: 'right' },
                {
                  header: 'Actions',
                  align: 'right',
                  cell: (c) => (
                    <Actions>
                      <Button
                        label="Rename"
                        variant="quiet"
                        size="sm"
                        onClick={() => show({ kind: 'rename', college: c })}
                      />
                      <Button
                        label="Merge into…"
                        variant="secondary"
                        size="sm"
                        onClick={() => show({ kind: 'merge', college: c })}
                      />
                    </Actions>
                  ),
                },
              ]}
            />
            <Sheet open={open?.kind === 'new'} title="Add college" onClose={() => setOpen(null)}>
              <Form onSubmit={() => run(() => api.staff.createCollege(name), done)}>
                <Input
                  label="Official name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <FormError>{error}</FormError>
                <Button type="submit" label="Add college" disabled={busy} />
              </Form>
            </Sheet>
            <Sheet
              open={open?.kind === 'rename'}
              title="Rename college"
              onClose={() => setOpen(null)}
            >
              {open?.kind === 'rename' && (
                <Form
                  onSubmit={() => run(() => api.staff.renameCollege(open.college.id, name), done)}
                >
                  <Input
                    label="Official name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <FormError>{error}</FormError>
                  <Button type="submit" label="Save" disabled={busy} />
                </Form>
              )}
            </Sheet>
            <Sheet
              open={open?.kind === 'merge'}
              title="Merge a duplicate"
              onClose={() => setOpen(null)}
            >
              {open?.kind === 'merge' && (
                <Form
                  onSubmit={() => run(() => api.staff.mergeCollege(open.college.id, into), done)}
                >
                  <Text variant="small" color="secondary">
                    {open.college.name}’s teams move to the college you pick, and{' '}
                    {open.college.name} leaves the list.
                  </Text>
                  <Select
                    label="Keep this college"
                    required
                    value={into}
                    onChange={(e) => setInto(e.target.value)}
                  >
                    <option value="">Pick one</option>
                    {list
                      .filter((c) => c.id !== open.college.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </Select>
                  <FormError>{error}</FormError>
                  <Button type="submit" label="Merge" disabled={busy || !into} />
                </Form>
              )}
            </Sheet>
          </>
        )}
      </Async>
    </>
  );
};
