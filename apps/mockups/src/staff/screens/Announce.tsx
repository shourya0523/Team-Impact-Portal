import { useState } from 'react';
import { useWorld } from '../../shared/store';
import type { EventItem, Post } from '../../shared/data';
import { Chip, Field, Logo } from '../../shared/ui';
import { Kicker, PageHead } from '../kit';
import { uid, useStaff } from '../state';

type Kind = 'Announcement' | 'Post' | 'Event';
type Aud = 'everyone' | 'tufts' | 'team';

const fmtDate = (iso: string) => {
  const d = new Date(iso + 'T12:00:00');
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};
const fmtTime = (hm: string) => {
  const [h = 0, m = 0] = hm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

export function Announce() {
  const { world, update } = useWorld();
  const { toast } = useStaff();
  const teams = world.teams.filter((t) => t.registered);
  const [kind, setKind] = useState<Kind>('Announcement');
  const [text, setText] = useState('');
  const [aud, setAud] = useState<Aud>('everyone');
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '');
  const [push, setPush] = useState(true);
  const [ev, setEv] = useState({ title: '', date: '', time: '', place: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});

  const team = world.teams.find((t) => t.id === teamId);
  const audLabel =
    aud === 'everyone' ? 'Everyone' : aud === 'tufts' ? 'Tufts teams' : (team?.name ?? 'One team');

  const post = () => {
    const er: Record<string, string> = {};
    if (text.trim().length < 10)
      er.text = text.trim()
        ? 'Write a little more so people know what this is about.'
        : 'Write a message first.';
    if (aud === 'team' && !team) er.team = 'Pick a team.';
    if (kind === 'Event') {
      if (!ev.title.trim()) er.title = 'Give the event a title.';
      if (!ev.date) er.date = 'Pick a date.';
      if (!ev.time) er.time = 'Pick a start time.';
      if (!ev.place.trim()) er.place = 'Add where it is.';
    }
    setErrs(er);
    if (Object.keys(er).length) return;
    const p: Post = {
      id: uid('p'),
      author: 'Team IMPACT',
      role: 'Staff',
      time: 'Just now',
      text: text.trim(),
      likes: 0,
      comments: [],
      official: true,
      scope: aud === 'team' ? 'team' : 'community',
      ...(aud === 'team' && team ? { team: team.id } : {}),
    };
    const e: EventItem | null =
      kind === 'Event'
        ? {
            id: uid('e'),
            title: ev.title.trim(),
            date: fmtDate(ev.date),
            time: fmtTime(ev.time),
            place: ev.place.trim(),
            host: 'Team IMPACT',
            hostRole: 'Staff',
            going: 0,
            rsvp: false,
            scope: audLabel,
          }
        : null;
    update((w) => ({ ...w, posts: [p, ...w.posts], events: e ? [...w.events, e] : w.events }));
    toast(`${kind} posted to ${audLabel}${push ? ' with a push notification' : ''}`);
    setText('');
    setEv({ title: '', date: '', time: '', place: '' });
  };

  const recent = world.posts.filter((p) => p.official);

  return (
    <div className="row wrap g24" style={{ alignItems: 'flex-start' }}>
      <div className="stack g14" style={{ flex: '1 1 420px' }}>
        <PageHead title="Post as Team IMPACT" />
        <div className="row g8 wrap" role="group" aria-label="Kind">
          {(['Announcement', 'Post', 'Event'] as Kind[]).map((k) => (
            <Chip key={k} on={kind === k} onClick={() => setKind(k)}>
              {k}
            </Chip>
          ))}
        </div>
        {kind === 'Event' && (
          <div className="grid2" style={{ gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Event title" htmlFor="ev-t" error={errs.title}>
                <input
                  id="ev-t"
                  className={'input' + (errs.title ? ' err' : '')}
                  value={ev.title}
                  onChange={(e) => setEv({ ...ev, title: e.target.value })}
                  placeholder="Family night: Tufts vs. Amherst"
                />
              </Field>
            </div>
            <Field label="Date" htmlFor="ev-d" error={errs.date}>
              <input
                id="ev-d"
                type="date"
                className={'input' + (errs.date ? ' err' : '')}
                value={ev.date}
                onChange={(e) => setEv({ ...ev, date: e.target.value })}
              />
            </Field>
            <Field label="Start time" htmlFor="ev-h" error={errs.time}>
              <input
                id="ev-h"
                type="time"
                className={'input' + (errs.time ? ' err' : '')}
                value={ev.time}
                onChange={(e) => setEv({ ...ev, time: e.target.value })}
              />
            </Field>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Where" htmlFor="ev-p" error={errs.place}>
                <input
                  id="ev-p"
                  className={'input' + (errs.place ? ' err' : '')}
                  value={ev.place}
                  onChange={(e) => setEv({ ...ev, place: e.target.value })}
                  placeholder="Kraft Field, Medford"
                />
              </Field>
            </div>
          </div>
        )}
        <Field label="Message" htmlFor="ab" error={errs.text}>
          <textarea
            id="ab"
            className={'textarea' + (errs.text ? ' input err' : '')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Family night at the Tufts home game, Oct 19. Details in Events."
            style={{ minHeight: 120 }}
          />
        </Field>
        <Field label="Who sees it" htmlFor="aud">
          <select
            id="aud"
            className="select"
            value={aud}
            onChange={(e) => setAud(e.target.value as Aud)}
          >
            <option value="everyone">Everyone on Team IMPACT</option>
            <option value="tufts">Tufts teams only</option>
            <option value="team">One team…</option>
          </select>
        </Field>
        {aud === 'team' && (
          <Field label="Team" htmlFor="aud-t" error={errs.team}>
            <select
              id="aud-t"
              className="select"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.college.replace(' University', '')}
                </option>
              ))}
            </select>
          </Field>
        )}
        <label className="check" style={{ alignItems: 'center' }}>
          <input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} />
          Also send as a push notification
        </label>
        <div className="tiny">
          Children’s profiles never see the network feed. Family and team audiences still follow the
          usual safety rules.
        </div>
        <button
          className="btn btn-primary btn-lg"
          style={{ alignSelf: 'flex-start' }}
          onClick={post}
        >
          Post now
        </button>
      </div>

      <div className="stack g10" style={{ flex: '1 1 320px', maxWidth: 420 }}>
        <Kicker>In the app</Kicker>
        <div
          aria-live="polite"
          style={{
            background: 'var(--navy)',
            color: '#fff',
            borderRadius: 16,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div className="row g8">
            <Logo size={22} boxed />
            <div style={{ fontSize: 14, fontWeight: 600 }}>Team IMPACT</div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '.1em',
                background: '#fff',
                color: 'var(--navy)',
                borderRadius: 999,
                padding: '3px 8px',
              }}
            >
              {kind.toUpperCase()}
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--on-navy)' }}>
              {audLabel}
            </div>
          </div>
          {kind === 'Event' && (ev.title || ev.date) && (
            <div
              style={{
                fontFamily: 'var(--display)',
                fontWeight: 800,
                fontSize: 24,
                textTransform: 'uppercase',
                lineHeight: 1,
              }}
            >
              {ev.title || 'Event title'}
            </div>
          )}
          {kind === 'Event' && (ev.date || ev.time || ev.place) && (
            <div style={{ fontSize: 14, color: 'var(--on-navy)' }}>
              {[ev.date && fmtDate(ev.date), ev.time && fmtTime(ev.time), ev.place]
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}
          <div
            style={{ fontSize: 16, lineHeight: 1.4, color: text ? '#fff' : 'var(--on-navy-muted)' }}
          >
            {text || 'Your message shows here as you type.'}
          </div>
        </div>
        <Kicker>Recent</Kicker>
        {recent.length === 0 ? (
          <div className="small">No staff posts yet.</div>
        ) : (
          <div className="list">
            {recent.slice(0, 8).map((p) => (
              <div key={p.id} className="stack g4" style={{ padding: '10px 14px' }}>
                <div
                  className="small"
                  style={{
                    color: 'var(--ink)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.text}
                </div>
                <div className="tiny">
                  {p.time} ·{' '}
                  {p.scope === 'team'
                    ? (world.teams.find((t) => t.id === p.team)?.name ?? 'one team')
                    : 'everyone'}{' '}
                  · {p.likes} likes{p.hidden ? ' · removed' : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
