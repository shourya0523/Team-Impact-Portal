// Recruiter app: quick review swipe deck, full card + contacts, lists, list detail, list picker / new list / filters sheets.
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useWorld, visibleToRecruiters } from '../../shared/store';
import { Empty, Field, Icon, Logo } from '../../shared/ui';
import { BackBtn, PhoneSheet, Screen, Title } from '../parts';
import { addNote, createList, removeFromList, saveToList, uid } from '../model';
import { useApp } from '../state';
import type { Athlete } from '../../shared/data';

const CO = 'northbeam';
const COLORS = ['#D0213C', '#1E3F7B', '#0F7B5F', '#4A4F57', '#7A1F2B'];
const COLLEAGUES = ['Priya', 'Tom', 'Lee'];

function useRecruiter() {
  const { world, update } = useWorld();
  const { local, setLocal, toast } = useApp();
  const visible = visibleToRecruiters(world);
  const lists = world.lists.filter((l) => l.companyId === CO);
  const target = lists.find((l) => l.id === local.rv.target) ?? lists[0];
  const { majors, years, regions } = local.rv;
  const deck = visible.filter(
    (a) =>
      (!majors.length || majors.includes(a.major.split(',')[0] ?? a.major)) &&
      (!years.length || years.includes(a.year)) &&
      (!regions.length || regions.includes(a.region)),
  );
  const teamOf = (a: Athlete) => world.teams.find((t) => t.id === a.teamId);
  const save = (a: Athlete) => {
    if (!target) return;
    if (target.athleteIds.includes(a.id)) {
      toast(`${a.first} is already in ${target.name}`);
      return;
    }
    update(saveToList(target.id, a.id));
    toast(`Saved ${a.first} to ${target.name}`);
  };
  const setRv = (p: Partial<typeof local.rv>) => setLocal((l) => ({ ...l, rv: { ...l.rv, ...p } }));
  return { world, update, visible, lists, target, deck, teamOf, save, setRv, rv: local.rv };
}

/** List picker, new list and filters sheets, shared by the review and lists screens. */
function RecruiterSheets({
  sheet,
  setSheet,
  from,
}: {
  sheet: null | 'pick' | 'new' | 'filters';
  setSheet: (s: null | 'pick' | 'new' | 'filters') => void;
  from: 'pick' | 'lists';
}) {
  const { nav, toast } = useApp();
  const { lists, target, visible, deck, setRv, rv, update } = useRecruiter();
  const [name, setName] = useState('');
  const [share, setShare] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const groups: { key: 'majors' | 'years' | 'regions'; label: string; opts: string[] }[] = [
    {
      key: 'majors',
      label: 'Major',
      opts: [...new Set(visible.map((a) => a.major.split(',')[0] ?? a.major))].sort(),
    },
    { key: 'years', label: 'Grad year', opts: [...new Set(visible.map((a) => a.year))].sort() },
    { key: 'regions', label: 'Region', opts: [...new Set(visible.map((a) => a.region))].sort() },
  ];
  const nameErr = !name.trim()
    ? 'Give the list a name.'
    : lists.some((l) => l.name.toLowerCase() === name.trim().toLowerCase())
      ? 'You already have a list with that name.'
      : '';
  const create = () => {
    if (nameErr) {
      setTried(true);
      return;
    }
    const id = uid('l');
    update(
      createList({
        id,
        companyId: CO,
        name: name.trim(),
        color: COLORS[lists.length % COLORS.length]!,
        athleteIds: [],
        sharedWith: share,
        updated: 'Today',
      }),
    );
    toast('Created ' + name.trim());
    setName('');
    setShare([]);
    setTried(false);
    setSheet(null);
    if (from === 'pick') setRv({ target: id });
    else nav.go('list', { id });
  };
  return (
    <PhoneSheet
      open={!!sheet}
      onClose={() => setSheet(null)}
      label={sheet === 'new' ? 'New list' : sheet === 'filters' ? 'Filters' : 'Choose a list'}
    >
      {sheet === 'pick' && (
        <div className="stack g10">
          <h2 className="display d-28">Save swipes to</h2>
          {lists.map((l) => (
            <button
              key={l.id}
              className="choice"
              aria-pressed={l.id === target?.id}
              onClick={() => {
                setRv({ target: l.id });
                setSheet(null);
                toast('Swipes now save to ' + l.name);
              }}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 16,
                fontWeight: 600,
                minHeight: 52,
                ...(l.id === target?.id
                  ? { background: 'var(--navy-tint)', color: 'var(--navy-pressed)' }
                  : {}),
              }}
            >
              <span>{l.name}</span>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{l.athleteIds.length}</span>
            </button>
          ))}
          <button
            className="btn btn-lg btn-full"
            style={{
              border: '1.5px dashed var(--navy)',
              background: 'transparent',
              color: 'var(--navy)',
            }}
            onClick={() => {
              setTried(false);
              setSheet('new');
            }}
          >
            + New list
          </button>
        </div>
      )}
      {sheet === 'new' && (
        <div className="stack g12">
          <div className="row between">
            <h2 className="display d-28">New list</h2>
            <button className="btn btn-ghost" onClick={() => setSheet(null)}>
              Cancel
            </button>
          </div>
          <Field label="List name" htmlFor="nl" error={tried ? nameErr : ''}>
            <input
              id="nl"
              className={'input' + (tried && nameErr ? ' err' : '')}
              style={{ minHeight: 50, fontSize: 17 }}
              placeholder="e.g. Summer 2027 interns"
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <div className="label">Share with colleagues</div>
          <div className="row wrap g8">
            {COLLEAGUES.map((p) => {
              const on = share.includes(p);
              return (
                <button
                  key={p}
                  className="chip"
                  aria-pressed={on}
                  onClick={() => setShare(on ? share.filter((x) => x !== p) : [...share, p])}
                >
                  {on ? '✓ ' : '+ '}
                  {p}
                </button>
              );
            })}
          </div>
          <div className="tiny">
            Only verified Northbeam recruiters. Anyone shared can add or remove athletes.
          </div>
          <button className="btn btn-primary btn-lg btn-full" onClick={create}>
            Create list
          </button>
        </div>
      )}
      {sheet === 'filters' && (
        <div className="stack g12">
          <div className="row between">
            <h2 className="display d-28">Filters</h2>
            <button
              className="btn btn-ghost"
              onClick={() => setRv({ majors: [], years: [], regions: [], idx: 0 })}
            >
              Clear
            </button>
          </div>
          {groups.map((g) => (
            <div key={g.key} className="stack g6">
              <div className="label">{g.label}</div>
              <div className="row wrap g8">
                {g.opts.map((m) => {
                  const cur = rv[g.key];
                  const on = cur.includes(m);
                  return (
                    <button
                      key={m}
                      className="chip chip-sm"
                      aria-pressed={on}
                      onClick={() =>
                        setRv({ [g.key]: on ? cur.filter((x) => x !== m) : [...cur, m], idx: 0 })
                      }
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="tiny">
            Showing {deck.length} athletes who published a card and are open to recruiting.
          </div>
          <button
            className="btn btn-primary btn-lg btn-full"
            onClick={() => {
              setRv({ idx: 0 });
              setSheet(null);
            }}
          >
            Show {deck.length} athletes
          </button>
        </div>
      )}
    </PhoneSheet>
  );
}

/* ---------------- Quick review ---------------- */
export function QuickReview() {
  const { nav, toast } = useApp();
  const { deck, target, teamOf, save, setRv, rv } = useRecruiter();
  const [dx, setDx] = useState(0);
  const [drag, setDrag] = useState<{ start: number } | null>(null);
  const [sheet, setSheet] = useState<null | 'pick' | 'new' | 'filters'>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const a = deck[rv.idx];
  const next = deck[rv.idx + 1];
  const swipe = (dir: 1 | -1) => {
    if (!a || timer.current) return;
    if (dir > 0) save(a);
    else toast('Skipped');
    setDrag(null);
    setDx(dir * 480);
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      setDx(0);
      setRv({ idx: rv.idx + 1 });
    }, 220);
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setDrag({ start: e.clientX - dx });
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (drag) setDx(e.clientX - drag.start);
  };
  const up = () => {
    if (!drag) return;
    if (dx > 110) swipe(1);
    else if (dx < -110) swipe(-1);
    else {
      setDrag(null);
      setDx(0);
    }
  };
  const p = Math.min(Math.abs(dx) / 120, 1);
  const team = a ? teamOf(a) : undefined;
  return (
    <Screen tabs style={{ padding: '52px 0 112px', gap: 10 }}>
      <div className="stack g10" style={{ padding: '0 20px' }}>
        <div className="row between">
          <div className="row g10">
            <Logo size={30} />
            <Title size={32}>Quick review</Title>
          </div>
          <div className="label" style={{ color: 'var(--muted)' }} aria-live="polite">
            {a ? `${rv.idx + 1} of ${deck.length}` : ''}
          </div>
        </div>
        <div className="row wrap g6">
          {[
            rv.majors.join(', ') || 'All majors',
            rv.regions.join(', '),
            rv.years.length ? 'Class of ' + rv.years.join(', ') : '',
          ]
            .filter(Boolean)
            .map((m) => (
              <span key={m} className="pill pill-navy" style={{ height: 30, fontSize: 13 }}>
                {m}
              </span>
            ))}
          <button
            className="btn btn-sm btn-quiet"
            style={{ minHeight: 30, borderRadius: 999, fontSize: 13, color: 'var(--navy)' }}
            onClick={() => setSheet('filters')}
          >
            Edit filters
          </button>
        </div>
        <div className="row g8 small">
          Swipe right saves to{' '}
          <button
            className="btn btn-sm"
            style={{
              minHeight: 32,
              border: '1.5px solid var(--navy)',
              background: '#fff',
              color: 'var(--navy)',
            }}
            onClick={() => setSheet('pick')}
          >
            {target?.name ?? 'a list'} ▾
          </button>
        </div>
      </div>
      <div style={{ position: 'relative', height: 456, marginTop: 4 }}>
        {next && a && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 36,
              right: 36,
              top: 16,
              height: 430,
              borderRadius: 20,
              background: 'var(--on-navy)',
              transform: 'scale(.95)',
            }}
          />
        )}
        {a && team ? (
          <div
            key={a.id}
            className="swipe-card"
            role="group"
            aria-roledescription="Swipeable card"
            aria-label={`${a.first} ${a.last}. Drag right to save, left to skip, or use the buttons below.`}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            style={{
              transform: `translateX(${dx}px) rotate(${dx / 18}deg)`,
              transition: drag ? 'none' : 'transform 260ms var(--spring)',
            }}
          >
            <div style={{ height: 10, background: 'var(--red)' }} />
            <div
              style={{
                position: 'relative',
                height: 170,
                background: 'var(--photo)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6B6559',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Athlete photo
              <div
                style={{
                  position: 'absolute',
                  left: 14,
                  top: 8,
                  fontFamily: 'var(--display)',
                  fontWeight: 800,
                  fontSize: 60,
                  lineHeight: 1,
                  color: '#fff',
                }}
              >
                {a.num}
              </div>
              <div
                className="swipe-tag"
                style={{
                  left: 18,
                  color: '#7BE0B9',
                  transform: 'rotate(-12deg)',
                  opacity: dx > 0 ? p : 0,
                }}
              >
                SAVE
              </div>
              <div
                className="swipe-tag"
                style={{
                  right: 18,
                  color: '#fff',
                  transform: 'rotate(12deg)',
                  opacity: dx < 0 ? p : 0,
                }}
              >
                SKIP
              </div>
            </div>
            <div className="stack g10" style={{ padding: '14px 18px' }}>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--display)',
                    fontWeight: 800,
                    fontSize: 32,
                    lineHeight: 0.95,
                    textTransform: 'uppercase',
                  }}
                >
                  {a.first} {a.last}
                </div>
                <div style={{ fontSize: 14, color: 'var(--on-navy)' }}>
                  {a.position} · {team.name} · {team.college.replace(' University', '')}
                </div>
              </div>
              <div
                className="grid3"
                style={{ borderTop: '1px solid rgba(255,255,255,.18)', paddingTop: 10, gap: 6 }}
              >
                <div>
                  <div className="bk">CLASS</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{a.year}</div>
                </div>
                <div>
                  <div className="bk">MAJOR</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{a.major.split(',')[0]}</div>
                </div>
                <div>
                  <div className="bk">DIVISION</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{a.division}</div>
                </div>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.4, color: 'var(--navy-tint)' }}>
                {a.exp} · {a.skills}
              </div>
              <div style={{ fontSize: 13, color: 'var(--on-navy-muted)' }}>
                {a.city} · {a.region}
              </div>
            </div>
          </div>
        ) : (
          <div
            className="stack g12"
            style={{
              position: 'absolute',
              left: 20,
              right: 20,
              top: 0,
              height: 440,
              borderRadius: 20,
              border: '2px dashed #C9C4B8',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: 24,
            }}
          >
            <div className="display d-36">{deck.length ? 'All caught up' : 'No matches'}</div>
            <div className="small" style={{ fontSize: 15 }}>
              {deck.length
                ? `${target?.name ?? 'Your list'} now has ${target?.athleteIds.length ?? 0} athletes. New athletes who match will show up here.`
                : 'Nobody matches these filters yet. Try another major.'}
            </div>
            {deck.length ? (
              <button className="btn btn-outline" onClick={() => setRv({ idx: 0 })}>
                Review again
              </button>
            ) : (
              <button className="btn btn-outline" onClick={() => setSheet('filters')}>
                Edit filters
              </button>
            )}
          </div>
        )}
      </div>
      {a && (
        <div className="row center" style={{ gap: 28 }}>
          <button
            aria-label="Skip"
            onClick={() => swipe(-1)}
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              border: '1.5px solid var(--field-line)',
              background: '#fff',
              color: 'var(--text-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Icon name="close" size={28} />
          </button>
          <button
            aria-label="Open full card"
            onClick={() => nav.go('rcard', { id: a.id })}
            style={{
              width: 52,
              height: 52,
              marginTop: 6,
              borderRadius: '50%',
              border: '1.5px solid var(--field-line)',
              background: '#fff',
              color: 'var(--navy)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Icon name="info" size={24} />
          </button>
          <button
            aria-label={'Save to ' + (target?.name ?? 'list')}
            onClick={() => swipe(1)}
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              border: 0,
              background: 'var(--red)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Icon name="heart" size={28} />
          </button>
        </div>
      )}
      <RecruiterSheets sheet={sheet} setSheet={setSheet} from="pick" />
    </Screen>
  );
}

/* ---------------- Full card + contacts ---------------- */
export function RecruiterCard() {
  const { nav, toast, local } = useApp();
  const { world, update, visible, lists, target, teamOf, save } = useRecruiter();
  const a = visible.find((x) => x.id === nav.params.id);
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  if (!a)
    return (
      <Screen>
        <BackBtn />
        <Empty title="Not available">This athlete isn’t open to recruiting right now.</Empty>
      </Screen>
    );
  const team = teamOf(a);
  const prefs = a.id === 'maya' ? local.rec : { Phone: false, Email: true, LinkedIn: true };
  const notes = world.notes.filter((n) => n.athleteId === a.id && n.companyId === CO);
  const inLists = lists.filter((l) => l.athleteIds.includes(a.id)).map((l) => l.name);
  return (
    <Screen style={{ gap: 12 }}>
      <BackBtn />
      <div
        className="row g14"
        style={{
          padding: 14,
          borderRadius: 18,
          background: 'var(--navy)',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 8,
            background: 'var(--red)',
          }}
        />
        <div
          style={{
            width: 86,
            height: 110,
            flexShrink: 0,
            borderRadius: 12,
            background: 'var(--photo)',
            padding: 6,
            marginLeft: 6,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--display)',
              fontWeight: 800,
              fontSize: 32,
              color: '#fff',
              lineHeight: 1,
            }}
          >
            {a.num}
          </span>
        </div>
        <div className="stack g4">
          <div
            style={{
              fontFamily: 'var(--display)',
              fontWeight: 800,
              fontSize: 28,
              lineHeight: 0.95,
              textTransform: 'uppercase',
            }}
          >
            {a.first} {a.last}
          </div>
          <div style={{ fontSize: 13, color: 'var(--on-navy)' }}>
            {a.position} · {team?.name} · Tufts · D-{a.division}
          </div>
          <div style={{ fontSize: 13, color: 'var(--on-navy)' }}>
            Class of {a.year} · {a.major}
          </div>
          <div style={{ fontSize: 13, color: 'var(--on-navy)' }}>{a.city}</div>
        </div>
      </div>
      <div className="sec">Contact {a.first}</div>
      <div className="list">
        {prefs.Email && (
          <button
            className="lrow"
            style={{ color: 'var(--navy)', fontSize: 15 }}
            onClick={() => toast('Opens your email to ' + a.first)}
          >
            <Icon name="mail" />
            {a.email}
          </button>
        )}
        {prefs.LinkedIn && (
          <button
            className="lrow"
            style={{ color: 'var(--navy)', fontSize: 15 }}
            onClick={() => toast('Opens LinkedIn')}
          >
            <Icon name="link" />
            {a.linkedin}
          </button>
        )}
        {prefs.Phone && a.phone && (
          <div className="lrow" style={{ fontSize: 15 }}>
            {a.phone}
          </div>
        )}
        {!prefs.Email && !prefs.LinkedIn && !(prefs.Phone && a.phone) && (
          <div className="lrow small" style={{ fontWeight: 400 }}>
            {a.first} hasn’t shared contact details with recruiters.
          </div>
        )}
      </div>
      <div className="sec">Experience</div>
      <div style={{ fontSize: 15, lineHeight: 1.45 }}>
        {a.exp} · {a.skills}
      </div>
      <div className="sec">Looking for</div>
      <div style={{ fontSize: 15, lineHeight: 1.45 }}>{a.looking}</div>
      {notes.length > 0 && (
        <>
          <div className="sec">Team notes</div>
          {notes.map((n) => (
            <div key={n.id} className="panel small" style={{ padding: '10px 12px' }}>
              <b style={{ fontWeight: 600 }}>{n.author}</b> · {n.date}
              <br />
              {n.text}
            </div>
          ))}
        </>
      )}
      <Field
        label="Note for your team at Northbeam"
        htmlFor="note"
        error={tried && !note.trim() ? 'Write a note first.' : ''}
      >
        <textarea
          id="note"
          className="textarea"
          style={{ minHeight: 64 }}
          placeholder="Strong fit for the spring analyst cohort."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <button
        className="btn btn-quiet"
        onClick={() => {
          if (!note.trim()) {
            setTried(true);
            return;
          }
          update(addNote(a.id, note.trim()));
          setNote('');
          setTried(false);
          toast('Note saved for your team');
        }}
      >
        Save note
      </button>
      <div className="tiny">
        {inLists.length ? 'Already in ' + inLists.join(', ') : 'Not in any list yet'}
      </div>
      <button className="btn btn-primary btn-lg btn-full mt-auto" onClick={() => save(a)}>
        Save to {target?.name ?? 'a list'}
      </button>
    </Screen>
  );
}

/* ---------------- Lists ---------------- */
export function Lists() {
  const { nav } = useApp();
  const { lists, target, visible } = useRecruiter();
  const [sheet, setSheet] = useState<null | 'pick' | 'new' | 'filters'>(null);
  return (
    <Screen tabs style={{ padding: '52px 20px 112px', gap: 14 }}>
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <div className="stack" style={{ gap: 2 }}>
          <div className="sec">Northbeam Capital</div>
          <Title>Lists</Title>
        </div>
        <button
          className="btn btn-primary btn-sm"
          style={{ borderRadius: 999, minHeight: 40 }}
          onClick={() => setSheet('new')}
        >
          New list
        </button>
      </div>
      {lists.map((l) => {
        const ids = l.athleteIds.filter((id) => visible.some((a) => a.id === id));
        return (
          <button
            key={l.id}
            className="card-row stack"
            onClick={() => nav.go('list', { id: l.id })}
            style={{
              flexDirection: 'column',
              alignItems: 'stretch',
              gap: 10,
              borderRadius: 16,
              borderTop: `5px solid ${l.color}`,
              padding: 14,
            }}
          >
            <span className="row between">
              <span style={{ fontSize: 17, fontWeight: 600 }}>{l.name}</span>
              <span className="small" style={{ color: 'var(--muted)' }}>
                {ids.length} {ids.length === 1 ? 'athlete' : 'athletes'}
              </span>
            </span>
            <span className="row g8">
              {ids.length > 0 && (
                <span className="row">
                  {ids.slice(0, 3).map((id) => (
                    <span
                      key={id}
                      className="tile"
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        marginRight: -6,
                        border: '2px solid #fff',
                        fontSize: 13,
                      }}
                    >
                      {visible.find((a) => a.id === id)?.num}
                    </span>
                  ))}
                </span>
              )}
              <span className="tiny" style={{ marginLeft: ids.length ? 10 : 0 }}>
                {l.sharedWith.length ? 'Shared with ' + l.sharedWith.join(', ') : 'Just you'} ·
                updated {l.updated.toLowerCase()}
                {l.id === target?.id ? ' · saving swipes here' : ''}
              </span>
            </span>
          </button>
        );
      })}
      <RecruiterSheets sheet={sheet} setSheet={setSheet} from="lists" />
    </Screen>
  );
}

export function ListDetail() {
  const { nav, toast } = useApp();
  const { lists, target, visible, setRv, update } = useRecruiter();
  const l = lists.find((x) => x.id === nav.params.id);
  if (!l)
    return (
      <Screen>
        <BackBtn label="Lists" />
        <Empty title="List not found" />
      </Screen>
    );
  const people = l.athleteIds
    .map((id) => visible.find((a) => a.id === id))
    .filter((a): a is Athlete => !!a);
  const isTarget = l.id === target?.id;
  return (
    <Screen style={{ gap: 12 }}>
      <BackBtn label="Lists" />
      <Title size={36}>{l.name}</Title>
      <div className="small" style={{ color: 'var(--muted)' }}>
        {l.sharedWith.length ? 'Shared with ' + l.sharedWith.join(', ') : 'Just you'} ·{' '}
        {people.length} athletes
      </div>
      {!people.length && (
        <div
          className="dashed small"
          style={{ padding: '24px 16px', textAlign: 'center', fontSize: 15 }}
        >
          Nobody here yet. Set this as your save list in Quick review and swipe right.
        </div>
      )}
      {people.map((a) => (
        <div key={a.id} className="card-row" style={{ padding: '10px 12px' }}>
          <button
            onClick={() => nav.go('rcard', { id: a.id })}
            className="row g12 grow"
            style={{
              border: 0,
              background: 'none',
              padding: 0,
              textAlign: 'left',
              cursor: 'pointer',
              font: 'inherit',
              color: 'var(--ink)',
            }}
          >
            <span
              className="tile"
              style={{
                width: 40,
                height: 48,
                borderRadius: 8,
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                padding: '3px 5px',
                fontSize: 16,
              }}
            >
              {a.num}
            </span>
            <span className="stack grow" style={{ gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>
                {a.first} {a.last}
              </span>
              <span className="tiny">
                {a.major.split(',')[0]} · {a.year}
              </span>
            </span>
          </button>
          <button
            className="btn btn-sm btn-quiet"
            onClick={() => {
              update(removeFromList(l.id, a.id));
              toast(`Removed ${a.first}`);
            }}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        className="btn btn-outline btn-lg btn-full"
        disabled={isTarget}
        onClick={() => {
          setRv({ target: l.id });
          toast('Swipes now save to ' + l.name);
        }}
      >
        {isTarget ? 'Swipes save to this list' : 'Save my swipes to this list'}
      </button>
    </Screen>
  );
}
