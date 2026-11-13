import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type {
  RecruiterList,
  RecruiterListDetail,
  RecruiterListEntry,
} from '@team-impact/contracts';
import { colors, fontWeight, spacing, typography } from '@team-impact/ui-tokens';
import { api } from '../../api';
import { Actions, Form, FormError, Textarea, useAction } from '../../forms';
import { useSession } from '../../session';
import {
  Async,
  Button,
  formatDate,
  fullName,
  Input,
  PageHeader,
  Sheet,
  Table,
  Text,
  Tile,
} from '../../ui';
import { useApi } from '../../useApi';

type Available = Extract<RecruiterListEntry, { available: true }>;

type Open = { kind: 'rename' } | { kind: 'note'; entry: Available } | null;

/** The owner renames and deletes a list; once they've left, anyone at the company can. */
export const canManage = (list: RecruiterList, meId: string | undefined) =>
  list.owner === null || list.owner.id === meId;

/** Rename the list and say what it's for. */
const ListSettings = ({ list, onDone }: { list: RecruiterListDetail; onDone: () => void }) => {
  const { busy, error, run } = useAction();
  const [name, setName] = useState(list.name);
  const [note, setNote] = useState(list.note ?? '');
  return (
    <Form onSubmit={() => run(() => api.updateList(list.id, { name, note: note || null }), onDone)}>
      <Input
        label="Name"
        required
        maxLength={60}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Input
        label="What it’s for"
        maxLength={300}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <FormError>{error}</FormError>
      <Button type="submit" label="Save" disabled={busy} />
    </Form>
  );
};

/** A company-wide note on one athlete; every colleague sees it, the athlete never does. */
const NoteForm = ({
  listId,
  entry,
  onDone,
}: {
  listId: string;
  entry: Available;
  onDone: () => void;
}) => {
  const { busy, error, run } = useAction();
  const [text, setText] = useState('');
  return (
    <Form onSubmit={() => run(() => api.setNote(listId, entry.card.athleteId, text), onDone)}>
      {entry.latestNote && (
        <Input label="Latest note" value={entry.latestNote.text} readOnly disabled />
      )}
      <Textarea
        label="New note"
        required
        maxLength={2000}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <FormError>{error}</FormError>
      <Button type="submit" label="Save note" disabled={busy} />
    </Form>
  );
};

/**
 * R6: one list's athletes, who added them, and the company's latest note on each. Athletes who've
 * left the employer portal show as "no longer available", with nothing about who they were.
 */
export const ListPage = () => {
  const { id = '' } = useParams();
  const { me } = useSession();
  const navigate = useNavigate();
  const { state, reload } = useApi(() => api.list(id), [id]);
  const [open, setOpen] = useState<Open>(null);
  const action = useAction();
  const done = () => {
    setOpen(null);
    reload();
  };

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
        {(list) => {
          const manage = canManage(list, me?.id);
          return (
            <>
              <PageHeader
                title={list.name}
                subtitle={`${list.note ?? 'No note'} · Owner ${
                  list.owner ? fullName(list.owner) : 'none'
                } · Everyone at your company sees this list`}
                action={
                  manage && (
                    <Actions>
                      <Button
                        label="Rename"
                        variant="quiet"
                        size="sm"
                        onClick={() => setOpen({ kind: 'rename' })}
                      />
                      <Button
                        label="Delete list"
                        variant="secondary"
                        size="sm"
                        disabled={action.busy}
                        onClick={() =>
                          window.confirm(`Delete ${list.name}? Notes on its athletes are kept.`) &&
                          action.run(
                            () => api.deleteList(list.id),
                            () => navigate('/lists'),
                          )
                        }
                      />
                    </Actions>
                  )
                }
              />
              <FormError>{action.error}</FormError>
              <Table
                rows={list.entries}
                rowKey={(e) => e.id}
                empty="No athletes on this list yet. Save them from search or their card."
                columns={[
                  {
                    header: 'Athlete',
                    cell: (e) =>
                      e.available ? (
                        <span
                          style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.sm }}
                        >
                          <Tile text={e.card.jerseyNumber ?? '–'} teamColor={e.card.team?.color} />
                          <Link
                            to={`/athletes/${e.card.athleteId}`}
                            style={{ color: colors.brand, fontWeight: fontWeight.semibold }}
                          >
                            {fullName(e.card)}
                          </Link>
                        </span>
                      ) : (
                        <Text variant="small" color="secondary">
                          No longer available
                        </Text>
                      ),
                  },
                  {
                    header: 'Team',
                    cell: (e) => (e.available ? (e.card.team?.name ?? 'Alumni') : '—'),
                  },
                  { header: 'Major', cell: (e) => (e.available ? e.card.major : '—') },
                  {
                    header: 'Added',
                    cell: (e) =>
                      `${e.addedBy ? fullName(e.addedBy) : 'A former colleague'}, ${formatDate(e.addedAt)}`,
                  },
                  {
                    header: 'Latest note',
                    cell: (e) => (e.available ? (e.latestNote?.text ?? '—') : '—'),
                    width: '28%',
                  },
                  {
                    header: 'Actions',
                    align: 'right',
                    cell: (e) => (
                      <Actions>
                        {e.available && (
                          <Button
                            label="Note"
                            variant="quiet"
                            size="sm"
                            onClick={() => setOpen({ kind: 'note', entry: e })}
                          />
                        )}
                        <Button
                          label="Remove"
                          variant="secondary"
                          size="sm"
                          disabled={action.busy}
                          onClick={() =>
                            action.run(() => api.removeFromList(list.id, e.id), reload)
                          }
                        />
                      </Actions>
                    ),
                  },
                ]}
              />
              <Sheet
                open={open?.kind === 'rename'}
                title="Rename list"
                onClose={() => setOpen(null)}
              >
                {open?.kind === 'rename' && <ListSettings list={list} onDone={done} />}
              </Sheet>
              <Sheet
                open={open?.kind === 'note'}
                title={open?.kind === 'note' ? `Note on ${fullName(open.entry.card)}` : 'Note'}
                onClose={() => setOpen(null)}
              >
                {open?.kind === 'note' && (
                  <NoteForm listId={list.id} entry={open.entry} onDone={done} />
                )}
              </Sheet>
            </>
          );
        }}
      </Async>
    </>
  );
};
