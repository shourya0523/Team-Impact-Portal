import { useState } from 'react';
import { Link } from 'react-router';
import { colors, fontWeight, spacing } from '@team-impact/ui-tokens';
import { api } from '../../api';
import { Form, FormError, useAction } from '../../forms';
import { useSession } from '../../session';
import {
  Async,
  Button,
  formatDate,
  fullName,
  Input,
  PageHeader,
  Select,
  Sheet,
  Table,
} from '../../ui';
import { useApi } from '../../useApi';
import { LIST_COLORS } from './listColors';

/** The list's own colour dot (runtime data, chosen by the recruiter). */
const DOT = spacing.md;

/** R6: the recruiter's own lists and the ones colleagues shared with them. */
export const ListsPage = () => {
  const { me } = useSession();
  const { state, reload } = useApi(() => api.lists());
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [color, setColor] = useState<string>(LIST_COLORS[0]!.value);
  const create = useAction();
  const remove = useAction();

  const submit = () =>
    create.run(
      () => api.createList({ name, color, ...(note.trim() ? { note } : {}) }),
      () => {
        setCreating(false);
        setName('');
        setNote('');
        reload();
      },
    );

  return (
    <>
      <PageHeader
        title="Lists"
        subtitle="Your shortlists and the ones colleagues shared with you."
        action={<Button label="New list" onClick={() => setCreating(true)} />}
      />
      <FormError>{remove.error}</FormError>
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
              {
                header: '',
                align: 'right',
                cell: (l) =>
                  l.owner.id === me?.id ? (
                    <Button
                      label="Delete"
                      variant="quiet"
                      size="sm"
                      disabled={remove.busy}
                      onClick={() =>
                        window.confirm(`Delete ${l.name}? Notes on its athletes are kept.`) &&
                        remove.run(() => api.deleteList(l.id), reload)
                      }
                    />
                  ) : null,
              },
            ]}
          />
        )}
      </Async>
      <Sheet open={creating} title="New list" onClose={() => setCreating(false)}>
        <Form onSubmit={submit}>
          <Input
            label="Name"
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="What it’s for (optional)"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Select label="Colour" value={color} onChange={(e) => setColor(e.target.value)}>
            {LIST_COLORS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
          <FormError>{create.error}</FormError>
          <Button type="submit" label="Create list" disabled={create.busy} />
        </Form>
      </Sheet>
    </>
  );
};
