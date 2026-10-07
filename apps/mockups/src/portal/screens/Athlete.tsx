import { useState } from 'react';
import { visibleToRecruiters, useWorld } from '../../shared/store';
import { BaseballCard, Back, Empty, Icon } from '../../shared/ui';
import { addNote, addToList, companyLists } from '../actions';
import { Blocked } from '../chrome';
import type { PortalProps } from '../ctx';
import { runSearch, teamFor } from '../logic';
import { NewListModal } from './ListModals';

const H2 = ({ children, id }: { children: string; id?: string }) => (
  <h2 id={id} className="display d-24">
    {children}
  </h2>
);

export default function Athlete(p: PortalProps) {
  const { world, update } = useWorld();
  const lists = companyLists(world, p.company.id);
  const [listId, setListId] = useState(lists[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [noteErr, setNoteErr] = useState('');
  const [newOpen, setNewOpen] = useState(false);

  const n = runSearch(world, p.filters).length;
  const from = p.canGoBack ? p.params.from : 'search';
  const backLabel =
    from === 'search'
      ? `Back to ${n} ${n === 1 ? 'result' : 'results'}`
      : from === 'list'
        ? 'Back to list'
        : from === 'jd'
          ? 'Back to matches'
          : 'Back';
  const goBack = () => (p.canGoBack ? p.back() : p.reset('search'));
  if (p.suspended)
    return (
      <>
        <Back onClick={goBack} label={backLabel} />
        <Blocked what="Viewing athlete cards" />
      </>
    );

  // Hard rule: only published + open-to-recruiting athletes are ever shown here.
  const a = visibleToRecruiters(world).find((x) => x.id === p.params.id);
  if (!a)
    return (
      <>
        <Back onClick={goBack} label={backLabel} />
        <Empty
          title="This card isn't available"
          action={
            <button className="btn btn-navy" onClick={() => p.reset('search')}>
              Back to search
            </button>
          }
        >
          The athlete may have turned off open to recruiting or unpublished their card.
        </Empty>
      </>
    );

  const team = teamFor(world, a);
  const notes = world.notes.filter((n) => n.athleteId === a.id && n.companyId === p.company.id);
  const inLists = lists.filter((l) => l.athleteIds.includes(a.id));
  const selected = lists.find((l) => l.id === listId) ?? lists[0];
  const skills = a.skills
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <>
      <Back onClick={goBack} label={backLabel} />
      <div className="row wrap" style={{ gap: 24, alignItems: 'flex-start' }}>
        <div
          className="row wrap"
          style={{ flex: '999 1 560px', minWidth: 0, gap: 18, alignItems: 'flex-start' }}
        >
          <div className="stack g8 deal" style={{ flex: '0 1 280px', alignItems: 'center' }}>
            <BaseballCard a={a} team={team} />
            <div className="tiny">Tap the card to flip it.</div>
          </div>
          <div
            className="panel stack g14"
            style={{ flex: '1 1 280px', padding: 20, borderRadius: 20 }}
          >
            <div className="eyebrow">Experience</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{a.exp}</div>
              <div className="small" style={{ color: 'var(--muted)' }}>
                {team.name} · {team.college}
              </div>
            </div>
            <div className="eyebrow">Skills</div>
            <div className="row wrap g6">
              {skills.map((s) => (
                <span key={s} className="pill pill-navy" style={{ fontSize: 14 }}>
                  {s}
                </span>
              ))}
            </div>
            <div className="eyebrow">Looking for</div>
            <div style={{ fontSize: 16 }}>
              {a.looking} · {a.region}
            </div>
            <div className="eyebrow">Also</div>
            <div style={{ fontSize: 16 }}>
              Class of {a.year} · {a.major} · Hometown {a.hometown}
            </div>
            {inLists.length > 0 && (
              <>
                <div className="eyebrow">In your lists</div>
                <div className="row wrap g6">
                  {inLists.map((l) => (
                    <button
                      key={l.id}
                      className="chip chip-sm"
                      onClick={() => p.go('list', { id: l.id })}
                    >
                      <span
                        style={{ width: 10, height: 10, borderRadius: '50%', background: l.color }}
                      />
                      {l.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <aside className="stack g16" style={{ flex: '1 1 320px', maxWidth: 420, minWidth: 0 }}>
          <section className="panel stack g10" style={{ padding: 18 }} aria-labelledby="ct">
            <H2 id="ct">{'Contact ' + a.first}</H2>
            <a
              href={'mailto:' + a.email}
              className="row g10"
              style={{
                minHeight: 44,
                fontWeight: 600,
                textDecoration: 'none',
                overflowWrap: 'anywhere',
              }}
            >
              <Icon name="mail" size={18} />
              {a.email}
            </a>
            <a
              href={'https://' + a.linkedin}
              target="_blank"
              rel="noreferrer"
              className="row g10"
              style={{
                minHeight: 44,
                fontWeight: 600,
                textDecoration: 'none',
                overflowWrap: 'anywhere',
              }}
            >
              <Icon name="link" size={18} />
              {a.linkedin}
            </a>
            {a.phone && (
              <a
                href={'tel:' + a.phone.replace(/\D/g, '')}
                className="row g10"
                style={{ minHeight: 44, fontWeight: 600, textDecoration: 'none' }}
              >
                <Icon name="comment" size={18} />
                {a.phone}
              </a>
            )}
            <div className="tiny">{a.first} chose these for recruiters.</div>
          </section>

          <section className="panel stack g10" style={{ padding: 18 }}>
            <label htmlFor="lst" className="display d-24">
              Save to a list
            </label>
            {lists.length ? (
              <div className="row g8">
                <select
                  id="lst"
                  className="select"
                  style={{ flexGrow: 1, minWidth: 0 }}
                  value={selected?.id ?? ''}
                  onChange={(e) => setListId(e.target.value)}
                >
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                      {l.athleteIds.includes(a.id) ? ' (already in)' : ''}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (!selected) return;
                    if (selected.athleteIds.includes(a.id))
                      return p.toast(`${a.first} is already in ${selected.name}`);
                    addToList(update, selected.id, a.id);
                    p.toast(`Saved ${a.first} to ${selected.name}`);
                  }}
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="tiny">You don't have any lists yet.</div>
            )}
            <button
              className="btn btn-ghost"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setNewOpen(true)}
            >
              <Icon name="plus" size={18} />
              New list
            </button>
          </section>

          <section className="panel stack g10" style={{ padding: 18 }} aria-labelledby="tn">
            <H2 id="tn">Team notes</H2>
            <div className="tiny">
              Shared with everyone at {p.company.name}. {a.first} never sees these.
            </div>
            {notes.length === 0 && <div className="small">No notes yet.</div>}
            {notes.map((n) => (
              <div
                key={n.id}
                className="stack"
                style={{
                  gap: 2,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'var(--ground)',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {n.author} · {n.date}
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.4 }}>{n.text}</div>
              </div>
            ))}
            <form
              className="stack g8"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (!note.trim()) return setNoteErr('Write something first.');
                addNote(update, a.id, p.company.id, p.account.name, note.trim());
                setNote('');
                setNoteErr('');
                p.toast('Note added for your team');
              }}
            >
              <label htmlFor="nt" className="sr-only">
                Add a note
              </label>
              <textarea
                id="nt"
                className="textarea"
                placeholder="Add a note for your team"
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setNoteErr('');
                }}
                style={{ minHeight: 70 }}
              />
              {noteErr && (
                <div className="err-text" role="alert">
                  {noteErr}
                </div>
              )}
              <button
                type="submit"
                className="btn btn-navy btn-sm"
                style={{ alignSelf: 'flex-end', minHeight: 44 }}
              >
                Add note
              </button>
            </form>
          </section>
        </aside>
      </div>
      <NewListModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        company={p.company}
        withAthlete={a.id}
        onCreated={(id, name) => {
          setNewOpen(false);
          setListId(id);
          p.toast(`Created ${name} with ${a.first} in it`);
        }}
      />
    </>
  );
}
