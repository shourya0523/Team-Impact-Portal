// Baseball Card: start -> upload -> reading -> review (inline edit) -> card (flip/tilt, publish, open to recruiting) -> export; editor; history.
import { useEffect, useRef, useState } from 'react';
import { useWorld } from '../../shared/store';
import { BaseballCard, Field, Icon, SwitchRow } from '../../shared/ui';
import { BackBtn, Err, Head, ModalBar, Screen, Title } from '../parts';
import { patchAthlete } from '../model';
import { useApp, type CardFields } from '../state';
import type { Athlete } from '../../shared/data';

const fieldsOf = (a: Athlete): CardFields => ({
  first: a.first,
  last: a.last,
  num: a.num,
  position: a.position,
  year: a.year,
  major: a.major,
  hometown: a.hometown,
  exp: a.exp,
  skills: a.skills,
  looking: a.looking,
});
function useMaya() {
  const { world } = useWorld();
  const a = world.athletes.find((x) => x.id === 'maya')!;
  const team = world.teams.find((t) => t.id === a.teamId)!;
  return { a, team };
}

/* ---------------- Card tab ---------------- */
export function CardHome() {
  const { local } = useApp();
  return local.hasCard ? <MyCard /> : <CardEmpty />;
}

function CardEmpty() {
  const { nav, me } = useApp();
  const { a } = useMaya();
  return (
    <Screen tabs style={{ padding: '52px 20px 112px', gap: 16 }}>
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <Title>Your card</Title>
        <div className="sec">SEASON 2026</div>
      </div>
      <div
        aria-hidden="true"
        style={{
          alignSelf: 'center',
          width: 230,
          height: 310,
          borderRadius: 18,
          border: '2px dashed #C9C4B8',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ height: 8, background: 'var(--red)' }} />
        <div
          style={{
            height: 150,
            background: 'var(--line-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            color: '#C9C4B8',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 12,
              top: 8,
              fontFamily: 'var(--display)',
              fontWeight: 800,
              fontSize: 48,
            }}
          >
            {a.num}
          </div>
          <Icon name="camera" size={32} />
        </div>
        <div className="stack g8" style={{ padding: '12px 14px' }}>
          <div
            style={{
              fontFamily: 'var(--display)',
              fontWeight: 800,
              fontSize: 26,
              lineHeight: 1,
              textTransform: 'uppercase',
            }}
          >
            {me.name}
          </div>
          <div
            style={{ height: 10, width: '70%', borderRadius: 5, background: 'var(--line-soft)' }}
          />
          <div
            style={{ height: 10, width: '50%', borderRadius: 5, background: 'var(--line-soft)' }}
          />
        </div>
      </div>
      <div className="stack g6">
        <div className="row between label">
          <span>Card 20% complete</span>
          <span style={{ color: 'var(--muted)' }}>Not published</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={20}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Card complete"
          style={{ height: 8, borderRadius: 4, background: '#E4DFD4' }}
        >
          <div style={{ width: '20%', height: 8, borderRadius: 4, background: 'var(--red)' }} />
        </div>
      </div>
      <button
        className="card-row"
        onClick={() => nav.go('upload')}
        style={{
          background: 'var(--navy)',
          color: '#fff',
          border: 0,
          padding: 16,
          borderRadius: 16,
        }}
      >
        <Icon name="upload" size={24} />
        <span className="stack grow" style={{ gap: 2 }}>
          <span style={{ fontSize: 17, fontWeight: 600 }}>Upload your resume</span>
          <span style={{ fontSize: 14, color: 'var(--on-navy)' }}>
            We fill your card in. You check it.
          </span>
        </span>
        <Icon name="next" />
      </button>
      <button className="btn btn-ghost btn-full" onClick={() => nav.go('editor')}>
        Fill it in by hand instead
      </button>
    </Screen>
  );
}

function MyCard() {
  const { nav, toast } = useApp();
  const { update } = useWorld();
  const { a, team } = useMaya();
  const badge = a.published
    ? a.openToRecruiting
      ? 'PUBLISHED · RECRUITABLE'
      : 'PUBLISHED'
    : 'DRAFT';
  return (
    <Screen tabs style={{ padding: '48px 20px 112px', gap: 12 }}>
      <div className="row between">
        <Title size={36}>Your card</Title>
        <span className={'pill ' + (a.published ? 'pill-ok' : 'pill-gray')}>{badge}</span>
      </div>
      <div className="deal" style={{ display: 'flex', justifyContent: 'center' }}>
        <BaseballCard a={a} team={{ ...team, color: 'var(--red)' }} />
      </div>
      <div className="tiny" style={{ textAlign: 'center' }}>
        Tap the card to flip it
      </div>
      <div className="list">
        <SwitchRow
          title="Publish my card"
          sub="Your team and families see it. Needed for recruiters."
          checked={a.published}
          onChange={(on) => {
            update(
              patchAthlete(
                'maya',
                on ? { published: true } : { published: false, openToRecruiting: false },
              ),
            );
            toast(on ? 'Card published' : 'Card unpublished. Recruiters can’t see you.');
          }}
        />
        <SwitchRow
          title="Open to recruiting"
          sub={
            a.published
              ? a.openToRecruiting
                ? 'Verified partner recruiters can find you.'
                : 'Recruiters can’t see you.'
              : 'Publish your card first.'
          }
          checked={a.openToRecruiting}
          disabled={!a.published}
          onChange={(on) => {
            update(patchAthlete('maya', { openToRecruiting: on }));
            toast(on ? 'Recruiters can now find your card' : 'You’re hidden from recruiters');
          }}
        />
      </div>
      <div className="grid2">
        <button className="btn btn-outline" onClick={() => nav.go('editor')}>
          Edit
        </button>
        <button className="btn btn-primary" onClick={() => nav.go('export')}>
          Save as image
        </button>
      </div>
      <div className="row g8 center">
        <button className="btn btn-ghost btn-sm" onClick={() => nav.go('history')}>
          Card history
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => nav.go('recruiting')}>
          Who can reach you
        </button>
      </div>
    </Screen>
  );
}

/* ---------------- Upload + reading ---------------- */
export function Upload() {
  const { nav, setLocal } = useApp();
  const { a } = useMaya();
  const [file, setFile] = useState<'pdf' | 'photo' | null>('pdf');
  const [agreed, setAgreed] = useState(false);
  const [tried, setTried] = useState(false);
  const [reading, setReading] = useState(false);
  const latest = useRef({ nav, setLocal, a });
  latest.current = { nav, setLocal, a };
  useEffect(() => {
    if (!reading) return;
    const t = window.setTimeout(() => {
      const { nav: n, setLocal: sl, a: ath } = latest.current;
      // Extracted text is untrusted: it only lands in a draft the athlete must confirm.
      sl((l) => ({
        ...l,
        cardDraft: {
          ...fieldsOf(ath),
          major: 'Economics, minor in Data Science',
          exp: 'Analyst intern, State Street (Summer 2026)',
        },
      }));
      n.replace('cardReview');
    }, 1800);
    return () => window.clearTimeout(t);
  }, [reading]);
  const err = !file ? 'Choose a file first.' : !agreed ? 'Tick the box to continue.' : '';
  if (reading) {
    return (
      <Screen style={{ justifyContent: 'center', gap: 18, padding: 24 }}>
        <div className="spinner" role="status" aria-label="Reading your resume" />
        <Title>Reading your resume</Title>
        <div className="stack g10" style={{ fontSize: 15 }}>
          <div className="row g10" style={{ color: '#0B5A45' }}>
            <Icon name="check" size={18} />
            Uploaded
          </div>
          <div className="row g10" style={{ color: '#0B5A45' }}>
            <Icon name="check" size={18} />
            Finding your school, major and experience
          </div>
          <div className="row g10" style={{ color: 'var(--text-2)' }}>
            <Icon name="more" size={18} />
            Filling in your card
          </div>
        </div>
        <div className="body">Nobody sees any of this until you check it and confirm.</div>
      </Screen>
    );
  }
  return (
    <Screen style={{ gap: 14 }}>
      <BackBtn label="Your card" />
      <Head eyebrow="BUILD YOUR CARD" title="Upload your resume" />
      <div className="grid2">
        {(['pdf', 'photo'] as const).map((k) => (
          <button
            key={k}
            className="choice c"
            aria-pressed={file === k}
            onClick={() => {
              setFile(k);
              setTried(false);
            }}
            style={{ minHeight: 104, flexDirection: 'column', gap: 8 }}
          >
            <Icon name={k === 'pdf' ? 'file' : 'camera'} size={24} />
            {k === 'pdf' ? 'Choose a PDF' : 'Take a photo'}
          </button>
        ))}
      </div>
      {file && (
        <div className="card-row">
          <span className="pdf">{file === 'pdf' ? 'PDF' : 'JPG'}</span>
          <span className="stack grow" style={{ gap: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>
              {file === 'pdf' ? 'Maya_Okafor_Resume.pdf' : 'Resume photo.jpg'}
            </span>
            <span className="tiny">1 page · {file === 'pdf' ? '240 KB' : '1.2 MB'}</span>
          </span>
          <button className="icon-btn" aria-label="Remove file" onClick={() => setFile(null)}>
            <Icon name="close" />
          </button>
        </div>
      )}
      <div className="tiny" style={{ color: 'var(--text-2)' }}>
        PDF or photo, up to 5 MB and 3 pages. We delete the file after reading it.
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => {
            setAgreed(e.target.checked);
            setTried(false);
          }}
        />
        This is my resume and I have the right to share it.
      </label>
      {tried && <Err>{err}</Err>}
      <button
        className="btn btn-primary btn-lg btn-full mt-auto"
        onClick={() => (err ? setTried(true) : setReading(true))}
      >
        Read my resume
      </button>
      <button className="btn btn-ghost btn-full" onClick={() => nav.replace('editor')}>
        Fill it in by hand instead
      </button>
    </Screen>
  );
}

/* ---------------- Review extracted fields ---------------- */
const ROWS: [keyof CardFields, string][] = [
  ['first', 'FIRST NAME'],
  ['last', 'LAST NAME'],
  ['position', 'POSITION'],
  ['num', 'NUMBER'],
  ['year', 'CLASS OF'],
  ['major', 'MAJOR'],
  ['hometown', 'HOMETOWN'],
  ['exp', 'EXPERIENCE'],
  ['skills', 'SKILLS'],
  ['looking', 'LOOKING FOR'],
];
export function CardReview() {
  const { nav, toast, local, setLocal } = useApp();
  const { update } = useWorld();
  const { a } = useMaya();
  const [f, setF] = useState<CardFields>(local.cardDraft ?? fieldsOf(a));
  const [editing, setEditing] = useState<keyof CardFields | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const needs = (['exp', 'skills'] as const).filter((k) => !checked.includes(k));
  const confirm = () => {
    if (needs.length) {
      setTried(true);
      return;
    }
    if (!f.first.trim() || !f.last.trim()) {
      setTried(true);
      return;
    }
    update(patchAthlete('maya', { ...f, published: false, openToRecruiting: false }));
    setLocal((l) => ({ ...l, hasCard: true, cardDraft: null }));
    toast('Card made. Publish it when you’re ready.');
    nav.reset('card');
  };
  return (
    <Screen style={{ gap: 12 }}>
      <Head
        eyebrow="FROM YOUR RESUME"
        title="Check your card"
        sub={
          <>
            Tap the pencil to fix anything. Nothing shows to anyone until you confirm.{' '}
            {needs.length
              ? `${needs.length} ${needs.length === 1 ? 'field needs' : 'fields need'} a look.`
              : 'Everything checked.'}
          </>
        }
      />
      <div className="panel" style={{ padding: '0 14px' }}>
        {ROWS.map(([k, label]) => {
          const ed = editing === k,
            need = needs.includes(k as 'exp');
          return (
            <div
              key={k}
              className="row g10"
              style={{
                padding: '8px 0',
                borderBottom: '1px solid var(--line-soft)',
                minHeight: 48,
              }}
            >
              <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
                <label
                  htmlFor={'rv-' + k}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '.08em',
                    color: 'var(--muted)',
                  }}
                >
                  {label}
                </label>
                {ed ? (
                  <input
                    id={'rv-' + k}
                    autoFocus
                    className="input"
                    style={{ minHeight: 38, fontSize: 15 }}
                    value={f[k]}
                    onChange={(e) => setF({ ...f, [k]: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setEditing(null);
                    }}
                  />
                ) : (
                  <div style={{ fontSize: 15, fontWeight: 500 }}>
                    {f[k] || <span style={{ color: 'var(--danger)' }}>Missing</span>}
                  </div>
                )}
              </div>
              {need && !ed && <span className="pill pill-warn">Check</span>}
              <button
                className="icon-btn"
                aria-label={(ed ? 'Done editing ' : 'Edit ') + label.toLowerCase()}
                style={{ color: 'var(--navy)', width: 44, flexShrink: 0 }}
                onClick={() => {
                  setEditing(ed ? null : k);
                  setChecked((c) => (c.includes(k) ? c : [...c, k]));
                }}
              >
                {ed ? (
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Done</span>
                ) : (
                  <Icon name="edit" size={18} />
                )}
              </button>
            </div>
          );
        })}
      </div>
      {tried && (
        <Err>
          {needs.length
            ? 'Open the fields marked Check and make sure they’re right.'
            : 'Your card needs a first and last name.'}
        </Err>
      )}
      <button className="btn btn-primary btn-lg btn-full mt-auto" onClick={confirm}>
        Looks right, make my card
      </button>
      <button className="btn btn-ghost btn-full" onClick={() => nav.go('editor')}>
        Edit everything by hand
      </button>
    </Screen>
  );
}

/* ---------------- Manual editor ---------------- */
export function CardEditor() {
  const { nav, toast, local, setLocal } = useApp();
  const { update } = useWorld();
  const { a } = useMaya();
  const [f, setF] = useState<CardFields & { city: string; region: string }>({
    ...fieldsOf(a),
    city: a.city,
    region: a.region,
  });
  const [tried, setTried] = useState(false);
  const errs = {
    first: !f.first.trim() ? 'Required.' : '',
    last: !f.last.trim() ? 'Required.' : '',
    num: f.num && !/^\d{1,2}$/.test(f.num) ? 'Use 0 to 99.' : '',
    major: !f.major.trim() ? 'Add your major.' : '',
  };
  const save = () => {
    if (Object.values(errs).some(Boolean)) {
      setTried(true);
      return;
    }
    const num = f.num ? f.num.padStart(2, '0') : '';
    update(
      patchAthlete('maya', {
        ...f,
        num,
        ...(local.hasCard ? {} : { published: false, openToRecruiting: false }),
      }),
    );
    setLocal((l) => ({ ...l, hasCard: true, cardDraft: null }));
    toast(local.hasCard ? 'Card saved' : 'Card made. Publish it when you’re ready.');
    nav.reset('card');
  };
  const inp = (k: keyof typeof f, label: string, opts: { half?: boolean; ph?: string } = {}) => (
    <Field
      label={label}
      htmlFor={'ce-' + k}
      error={tried ? (errs as Record<string, string>)[k] : ''}
    >
      <input
        id={'ce-' + k}
        className={'input' + (tried && (errs as Record<string, string>)[k] ? ' err' : '')}
        value={f[k]}
        placeholder={opts.ph}
        onChange={(e) => setF({ ...f, [k]: e.target.value })}
      />
    </Field>
  );
  return (
    <Screen style={{ gap: 12 }}>
      <ModalBar
        title="Edit card"
        onCancel={nav.back}
        action={
          <button className="btn btn-ghost" style={{ color: 'var(--red)' }} onClick={save}>
            Save
          </button>
        }
      />
      <div className="sec">About you</div>
      <div className="grid2">
        {inp('first', 'First name')}
        {inp('last', 'Last name')}
      </div>
      <div className="grid2">
        {inp('position', 'Position')}
        {inp('num', 'Number')}
      </div>
      <div className="sec" style={{ marginTop: 4 }}>
        Academics
      </div>
      <div className="grid2">
        {inp('major', 'Major')}
        <Field label="Class of" htmlFor="ce-year">
          <select
            id="ce-year"
            className="select"
            value={f.year}
            onChange={(e) => setF({ ...f, year: e.target.value })}
          >
            {['2026', '2027', '2028', '2029', '2030'].map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="sec" style={{ marginTop: 4 }}>
        Where you want to work
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10 }}>
        {inp('city', 'City')}
        <Field label="Region" htmlFor="ce-rg">
          <select
            id="ce-rg"
            className="select"
            value={f.region}
            onChange={(e) => setF({ ...f, region: e.target.value })}
          >
            {['Northeast', 'Midwest', 'South', 'West'].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
      </div>
      {inp('hometown', 'Hometown')}
      <div className="sec" style={{ marginTop: 4 }}>
        Experience and skills
      </div>
      {inp('exp', 'Experience', { ph: 'Analyst intern, State Street (Summer 2026)' })}
      {inp('skills', 'Skills', { ph: 'Excel, SQL, team captain' })}
      {inp('looking', 'Looking for', { ph: 'Finance internships, Boston' })}
      <div className="tiny">
        Saved as your 2026 season card.{' '}
        {local.hasCard
          ? 'Changes show wherever your card is published.'
          : 'Nobody sees it until you publish.'}{' '}
        No health details, please.
      </div>
      <button className="btn btn-primary btn-lg btn-full" onClick={save}>
        Save card
      </button>
    </Screen>
  );
}

/* ---------------- Export as image ---------------- */
export function ExportCard() {
  const { nav, toast } = useApp();
  const { a, team } = useMaya();
  const [size, setSize] = useState<'story' | 'square'>('story');
  const [back, setBack] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <div
      className="screen m-dark"
      style={{ position: 'relative', minHeight: '100%', paddingBottom: 380 }}
    >
      <div style={{ padding: '52px 20px 0' }}>
        <BackBtn label="Your card" light />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
        <div
          style={{
            width: size === 'story' ? 220 : 250,
            borderRadius: 16,
            overflow: 'hidden',
            background: 'var(--navy)',
            color: '#fff',
            boxShadow: '0 20px 40px rgba(0,0,0,.4)',
          }}
        >
          <div style={{ height: 8, background: 'var(--red)' }} />
          <div
            style={{
              position: 'relative',
              height: size === 'story' ? 190 : 150,
              background: 'var(--photo)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6B6559',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Athlete photo
            <div
              style={{
                position: 'absolute',
                left: 10,
                top: 6,
                fontFamily: 'var(--display)',
                fontWeight: 800,
                fontSize: 50,
                lineHeight: 1,
                color: '#fff',
              }}
            >
              {a.num}
            </div>
            <img
              src="/logo.png"
              alt=""
              style={{
                position: 'absolute',
                right: 8,
                top: 8,
                width: 26,
                background: '#fff',
                borderRadius: 6,
                padding: 3,
              }}
            />
          </div>
          <div className="stack g4" style={{ padding: '12px 14px' }}>
            <div
              style={{
                fontFamily: 'var(--display)',
                fontWeight: 800,
                fontSize: 26,
                lineHeight: 1,
                textTransform: 'uppercase',
              }}
            >
              {a.first} {a.last}
            </div>
            <div style={{ fontSize: 12, color: 'var(--on-navy)' }}>
              {a.position} · {team.name} · Tufts
            </div>
            <div style={{ fontSize: 12, color: 'var(--on-navy)' }}>
              Class of {a.year} · {a.major.split(',')[0]} · D-{a.division}
            </div>
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 13, color: '#B9BDC4', marginTop: 14 }}>
        {size === 'story' ? '1080 × 1920' : '1080 × 1080'} image ·{' '}
        {back ? 'front and back' : 'front'} of your 2026 card
      </div>
      <div
        className="stack g12"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--ground)',
          color: 'var(--ink)',
          borderRadius: '24px 24px 0 0',
          padding: '12px 20px 30px',
        }}
      >
        <div
          style={{
            width: 40,
            height: 5,
            borderRadius: 3,
            background: 'var(--field-line)',
            alignSelf: 'center',
          }}
        />
        <Title size={28}>Save your card</Title>
        <div className="row g8">
          {(['story', 'square'] as const).map((z) => (
            <button
              key={z}
              className="chip"
              aria-pressed={size === z}
              onClick={() => {
                setSize(z);
                setSaved(false);
              }}
            >
              {z === 'story' ? 'Story 9:16' : 'Square 1:1'}
            </button>
          ))}
        </div>
        <label className="check" style={{ alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={back}
            onChange={(e) => {
              setBack(e.target.checked);
              setSaved(false);
            }}
          />
          Include the back of the card
        </label>
        {saved && (
          <div className="notice-ok" role="status">
            Saved to Photos
          </div>
        )}
        <div className="grid2">
          <button
            className="btn btn-primary"
            onClick={() => {
              setSaved(true);
              toast('Saved to Photos');
            }}
          >
            Save to Photos
          </button>
          <button className="btn btn-outline" onClick={() => toast('Share sheet opens here')}>
            Share…
          </button>
        </div>
        <div className="tiny">Your contact details are never printed on the image.</div>
        <button className="btn btn-ghost btn-full" onClick={nav.back}>
          Done
        </button>
      </div>
    </div>
  );
}

/* ---------------- Season history ---------------- */
export function CardHistory() {
  const { nav, toast } = useApp();
  const { a } = useMaya();
  const seasons = [
    {
      year: 'Season 2026',
      line: `${a.position} · ${a.major.split(',')[0]} · ${a.exp.split(',')[0]}`,
      state: 'Current · ' + (a.published ? 'Published' : 'Draft'),
      bg: 'var(--navy)',
      current: true,
    },
    {
      year: 'Season 2025',
      line: `${a.position} · Undeclared · Rookie year`,
      state: 'Archived',
      bg: 'var(--text-2)',
      current: false,
    },
  ];
  return (
    <Screen style={{ gap: 14 }}>
      <BackBtn label="Your card" />
      <Title>Your seasons</Title>
      {seasons.map((s) => (
        <button
          key={s.year}
          className="card-row"
          style={{ padding: 12, borderRadius: 16, gap: 14 }}
          onClick={() => (s.current ? nav.back() : toast('Archived cards are only visible to you'))}
        >
          <span
            style={{
              width: 72,
              height: 96,
              flexShrink: 0,
              borderRadius: 10,
              overflow: 'hidden',
              background: s.bg,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span style={{ height: 5, background: 'var(--red)' }} />
            <span
              style={{
                padding: 6,
                color: '#fff',
                fontFamily: 'var(--display)',
                fontWeight: 800,
                fontSize: 26,
              }}
            >
              {a.num}
            </span>
          </span>
          <span className="stack grow" style={{ gap: 3 }}>
            <span
              style={{
                fontFamily: 'var(--display)',
                fontWeight: 800,
                fontSize: 24,
                textTransform: 'uppercase',
              }}
            >
              {s.year}
            </span>
            <span className="small">{s.line}</span>
            <span className="tiny">{s.state}</span>
          </span>
          <Icon name="next" />
        </button>
      ))}
      <button
        className="btn btn-full"
        style={{ border: '1.5px dashed #C9C4B8', background: 'transparent', color: 'var(--navy)' }}
        onClick={() => nav.go('upload')}
      >
        Start the 2027 season card
      </button>
      <div className="tiny">Recruiters and families only ever see your current season.</div>
    </Screen>
  );
}
