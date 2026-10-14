import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { RecruiterListDetail, RecruiterListEntry } from '@team-impact/contracts';
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
  Select,
  Sheet,
  Table,
  Tile,
} from '../../ui';
import { useApi } from '../../useApi';

type Open = { kind: 'rename' | 'share' } | { kind: 'note'; entry: RecruiterListEntry } | null;

/** Owner only: rename and share with a colleague at the same company. */
const ListSettings = ({
  list,
  kind,
  onDone,
}: {
  list: RecruiterListDetail;
  kind: 'rename' | 'share';
  onDone: () => void;
}) => {
  const colleagues = useApi(() => api.colleagues());
  const { busy, error, run } = useAction();
  const [name, setName] = useState(list.name);
  const [note, setNote] = useState(list.note ?? '');
  const [userId, setUserId] = useState('');
  if (kind === 'rename') {
    return (
      <Form
        onSubmit={() => run(() => api.updateList(list.id, { name, note: note || null }), onDone)}
      >
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
  }
  const shared = new Set(list.sharedWith.map((u) => u.id));
  return (
    <Async state={colleagues.state}>
      {(people) => {
        const options = people.filter((p) => !shared.has(p.id));
        return (
          <Form onSubmit={() => run(() => api.shareList(list.id, userId), onDone)}>
            <Select
              label="Colleague at your company"
              required
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">
                {options.length ? 'Pick a colleague' : 'Everyone already has it'}
              </option>
              {options.map((p) => (
                <option key={p.id} value={p.id}>
                  {fullName(p)}
                </option>
              ))}
            </Select>
            {list.sharedWith.length > 0 && (
              <Actions>
                {list.sharedWith.map((u) => (
                  <Button
                    key={u.id}
                    label={`Stop sharing with ${fullName(u)}`}
                    variant="quiet"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          api.updateList(list.id, {
                            sharedWithUserIds: list.sharedWith
                              .map((x) => x.id)
                              .filter((id) => id !== u.id),
                          }),
                        onDone,
                      )
                    }
                  />
                ))}
              </Actions>
            )}
            <FormError>{error}</FormError>
            <Button type="submit" label="Share" disabled={busy || !userId} />
          </Form>
        );
      }}
    </Async>
  );
};

/** A company-wide note on one athlete; every colleague sees it, the athlete never does. */
const NoteForm = ({
  listId,
  entry,
  onDone,
}: {
  listId: string;
  entry: RecruiterListEntry;
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

/** R6: one list's athletes, who added them, and the company's latest note on each. */
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
          const owner = list.owner.id === me?.id;
          return (
            <>
              <PageHeader
                title={list.name}
                subtitle={`${list.note ?? 'No note'} · Owner ${fullName(list.owner)}${
                  list.sharedWith.length
                    ? ` · Shared with ${list.sharedWith.map(fullName).join(', ')}`
                    : ''
                }`}
                action={
                  owner && (
                    <Actions>
                      <Button
                        label="Rename"
                        variant="quiet"
                        size="sm"
                        onClick={() => setOpen({ kind: 'rename' })}
                      />
                      <Button
                        label="Share"
                        variant="secondary"
                        size="sm"
                        onClick={() => setOpen({ kind: 'share' })}
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
                rowKey={(e) => e.card.id}
                empty="No athletes here right now. Athletes who turn recruiting off drop out until they turn it back on."
                columns={[
                  {
                    header: 'Athlete',
                    cell: (e) => (
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
                    ),
                  },
                  { header: 'Team', cell: (e) => e.card.team?.name ?? 'Alumni' },
                  { header: 'Major', cell: (e) => e.card.major },
                  {
                    header: 'Added',
                    cell: (e) => `${fullName(e.addedBy)}, ${formatDate(e.addedAt)}`,
                  },
                  {
                    header: 'Latest note',
                    cell: (e) => e.latestNote?.text ?? '—',
                    width: '28%',
                  },
                  {
                    header: 'Actions',
                    align: 'right',
                    cell: (e) => (
                      <Actions>
                        <Button
                          label="Note"
                          variant="quiet"
                          size="sm"
                          onClick={() => setOpen({ kind: 'note', entry: e })}
                        />
                        <Button
                          label="Remove"
                          variant="secondary"
                          size="sm"
                          disabled={action.busy}
                          onClick={() =>
                            action.run(() => api.removeFromList(list.id, e.card.athleteId), reload)
                          }
                        />
                      </Actions>
                    ),
                  },
                ]}
              />
              <Sheet
                open={open?.kind === 'rename' || open?.kind === 'share'}
                title={open?.kind === 'share' ? 'Share list' : 'Rename list'}
                onClose={() => setOpen(null)}
              >
                {(open?.kind === 'rename' || open?.kind === 'share') && (
                  <ListSettings list={list} kind={open.kind} onDone={done} />
                )}
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
