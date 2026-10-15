import { useState } from 'react';
import { visibleToRecruiters, useWorld } from '../../shared/store';
import { Back, Empty, Icon } from '../../shared/ui';
import { companyLists, deleteList, patchList, removeFromList } from '../actions';
import { Jersey } from '../chrome';
import type { PortalProps } from '../ctx';
import { colleagueName, teamFor } from '../logic';
import { NewListModal, ShareListModal } from './ListModals';

export function Lists(p: PortalProps) {
  const { world } = useWorld();
  const [newOpen, setNewOpen] = useState(p.params.new === '1');
  const lists = companyLists(world, p.company.id);
  const vis = visibleToRecruiters(world);

  return (
    <>
      <div className="row wrap g12" style={{ alignItems: 'flex-end' }}>
        <div className="stack" style={{ gap: 2 }}>
          <div className="eyebrow red">Shared across {p.company.name}</div>
          <h1 className="display d-48">Lists</h1>
        </div>
        <button
          className="btn btn-primary"
          style={{ marginLeft: 'auto' }}
          onClick={() => setNewOpen(true)}
        >
          <Icon name="plus" size={18} />
          New list
        </button>
      </div>
      {lists.length === 0 ? (
        <Empty
          title="No lists yet"
          action={
            <button className="btn btn-primary" onClick={() => setNewOpen(true)}>
              Make your first list
            </button>
          }
        >
          Lists keep the athletes you like in one place, and your colleagues can add to them too.
        </Empty>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))',
            gap: 16,
          }}
        >
          {lists.map((l) => {
            const members = l.athleteIds
              .map((id) => vis.find((a) => a.id === id))
              .filter((a) => !!a);
            return (
              <button
                key={l.id}
                onClick={() => p.go('list', { id: l.id })}
                className="panel stack g14"
                style={{
                  padding: 20,
                  borderRadius: 18,
                  borderTop: '6px solid ' + l.color,
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'var(--ink)',
                }}
              >
                <div className="row between g8" style={{ alignItems: 'baseline', width: '100%' }}>
                  <div className="display d-28" style={{ color: 'var(--ink)' }}>
                    {l.name}
                  </div>
                  <div className="small" style={{ whiteSpace: 'nowrap' }}>
                    {members.length} {members.length === 1 ? 'athlete' : 'athletes'}
                  </div>
                </div>
                <div className="row g6" style={{ minHeight: 50 }}>
                  {members.length ? (
                    members
                      .slice(0, 5)
                      .map((a) => <Jersey key={a.id} num={a.num} w={40} h={50} font={16} />)
                  ) : (
                    <span className="tiny">Empty for now</span>
                  )}
                </div>
                <div className="row between g8 tiny" style={{ width: '100%' }}>
                  <span>
                    {l.sharedWith.length ? 'You, ' + l.sharedWith.join(', ') : 'Just you'}
                  </span>
                  <span>Updated {l.updated === 'Today' ? 'today' : l.updated}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
      <NewListModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        company={p.company}
        onCreated={(id, name) => {
          setNewOpen(false);
          p.toast(`Created ${name}`);
          p.go('list', { id });
        }}
      />
    </>
  );
}

export function ListDetail(p: PortalProps) {
  const { world, update } = useWorld();
  const list = companyLists(world, p.company.id).find((l) => l.id === p.params.id);
  const [shareOpen, setShareOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(list?.name ?? '');
  const [nameErr, setNameErr] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [note, setNote] = useState(list?.note ?? '');
  const goLists = () => p.reset('lists');

  if (!list)
    return (
      <>
        <Back onClick={goLists} label="All lists" />
        <Empty
          title="List not found"
          action={
            <button className="btn btn-navy" onClick={goLists}>
              All lists
            </button>
          }
        >
          It may have been deleted by a colleague.
        </Empty>
      </>
    );

  const vis = visibleToRecruiters(world);
  const rows = list.athleteIds.map((id) => vis.find((a) => a.id === id)).filter((a) => !!a);
  const shared = list.sharedWith.map(colleagueName);
  const latestNote = (aid: string) =>
    [...world.notes].reverse().find((n) => n.athleteId === aid && n.companyId === p.company.id);

  return (
    <>
      <Back onClick={goLists} label="All lists" />
      <div className="row wrap g12" style={{ alignItems: 'flex-end' }}>
        {renaming ? (
          <form
            className="stack g6"
            style={{ flex: '1 1 320px' }}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return setNameErr('Give the list a name.');
              patchList(update, list.id, { name: name.trim() });
              setRenaming(false);
              setNameErr('');
              p.toast('List renamed');
            }}
          >
            <label className="label" htmlFor="rn">
              List name
            </label>
            <div className="row g8">
              <input
                id="rn"
                className={'input' + (nameErr ? ' err' : '')}
                value={name}
                maxLength={60}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameErr('');
                }}
                autoFocus
                style={{ minWidth: 0 }}
              />
              <button type="submit" className="btn btn-navy">
                Save
              </button>
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => {
                  setRenaming(false);
                  setName(list.name);
                  setNameErr('');
                }}
              >
                Cancel
              </button>
            </div>
            {nameErr && (
              <div className="err-text" role="alert">
                {nameErr}
              </div>
            )}
          </form>
        ) : (
          <div className="stack g6" style={{ minWidth: 0 }}>
            <div className="row g10">
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: list.color,
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
              <h1 className="display d-48">{list.name}</h1>
            </div>
            <div className="small">
              {rows.length} {rows.length === 1 ? 'athlete' : 'athletes'} ·{' '}
              {shared.length ? 'shared with ' + shared.join(', ') : 'only you'}
            </div>
          </div>
        )}
        <div className="row wrap g8" style={{ marginLeft: 'auto' }}>
          <button className="btn btn-outline" onClick={() => setShareOpen(true)}>
            <Icon name="share" size={18} />
            Share with a colleague
          </button>
          <button className="btn btn-primary" onClick={() => p.reset('search')}>
            <Icon name="plus" size={18} />
            Add athletes
          </button>
          {!renaming && (
            <button
              className="btn btn-quiet"
              onClick={() => {
                setName(list.name);
                setRenaming(true);
              }}
            >
              <Icon name="edit" size={18} />
              Rename
            </button>
          )}
          <button
            className="btn btn-quiet"
            style={{ color: 'var(--danger)' }}
            onClick={() => setConfirmDel(true)}
            aria-expanded={confirmDel}
          >
            <Icon name="trash" size={18} />
            Delete
          </button>
        </div>
      </div>

      {confirmDel && (
        <div
          role="alertdialog"
          aria-labelledby="del-t"
          className="panel stack g10 rise"
          style={{ padding: 18, borderColor: 'var(--danger)', animationDelay: '0ms' }}
        >
          <div id="del-t" className="strong" style={{ fontSize: 17 }}>
            Delete {list.name}?
          </div>
          <div className="small">
            This removes the list for everyone at {p.company.name}
            {shared.length ? ` (${shared.join(', ')})` : ''}. Athletes are not notified and your
            team notes are kept.
          </div>
          <div className="row wrap g8">
            <button
              className="btn btn-danger"
              onClick={() => {
                deleteList(update, list.id);
                p.toast(`Deleted ${list.name}`);
                goLists();
              }}
            >
              Delete list
            </button>
            <button className="btn btn-quiet" onClick={() => setConfirmDel(false)}>
              Keep it
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <Empty
          title="No athletes yet"
          action={
            <button className="btn btn-primary" onClick={() => p.reset('search')}>
              Find athletes
            </button>
          }
        >
          Save athletes from search or from their card.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th scope="col">Athlete</th>
                <th scope="col">Sport</th>
                <th scope="col">Class · major</th>
                <th scope="col">Contact</th>
                <th scope="col">Latest note</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const n = latestNote(a.id);
                return (
                  <tr key={a.id}>
                    <td>
                      <button
                        onClick={() => p.go('athlete', { id: a.id, from: 'list' })}
                        className="row g10"
                        style={{
                          border: 0,
                          background: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          fontWeight: 600,
                          color: 'var(--navy)',
                          fontSize: 15,
                          minHeight: 44,
                          textAlign: 'left',
                        }}
                      >
                        <Jersey num={a.num} w={32} h={40} font={14} />
                        {a.first} {a.last}
                      </button>
                    </td>
                    <td>{teamFor(world, a).name}</td>
                    <td>
                      {a.year} · {a.major}
                    </td>
                    <td>
                      <a href={'mailto:' + a.email}>Email</a>,{' '}
                      <a href={'https://' + a.linkedin} target="_blank" rel="noreferrer">
                        LinkedIn
                      </a>
                      {a.phone ? ', phone' : ''}
                    </td>
                    <td style={{ maxWidth: 280 }}>
                      {n ? (
                        <>
                          <span>{n.text}</span>
                          <div className="tiny">
                            {n.author.split(' ')[0]} · {n.date}
                          </div>
                        </>
                      ) : (
                        <span className="tiny">No notes</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ minHeight: 44 }}
                        aria-label={`Remove ${a.first} ${a.last} from ${list.name}`}
                        onClick={() => {
                          removeFromList(update, list.id, a.id);
                          p.toast(`Removed ${a.first} from ${list.name}`);
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <form
        className="panel stack g10"
        style={{ padding: 18, maxWidth: 640 }}
        onSubmit={(e) => {
          e.preventDefault();
          patchList(update, list.id, { note: note.trim() || undefined });
          p.toast('List note saved');
        }}
      >
        <label htmlFor="ln" className="display d-24">
          List note
        </label>
        <div className="tiny">What the list is for. Everyone the list is shared with sees it.</div>
        <textarea
          id="ln"
          className="textarea"
          placeholder="Role, team or hiring cycle"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ minHeight: 70 }}
        />
        <button
          type="submit"
          className="btn btn-navy btn-sm"
          style={{ alignSelf: 'flex-end', minHeight: 44 }}
        >
          Save note
        </button>
      </form>

      <ShareListModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        list={list}
        company={p.company}
        account={p.account}
        toast={p.toast}
      />
    </>
  );
}
