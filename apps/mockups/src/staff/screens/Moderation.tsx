import { useState } from 'react';
import { useWorld } from '../../shared/store';
import type { Ticket } from '../../shared/data';
import { Back, Chip, Empty, Pill } from '../../shared/ui';
import { Kicker, PageHead } from '../kit';
import { STAFF_NAME, firstName, nowLabel, useStaff } from '../state';

type Status = Ticket['status'];
const REDS = ['Inappropriate for kids', 'Bullying', 'Pretending to be someone'];
const ReasonPill = ({ t }: { t: Ticket }) => (
  <Pill tone={REDS.includes(t.reason) ? 'red' : 'warn'}>{t.reason}</Pill>
);
const STATUS_TEXT: Record<Status, string> = {
  open: 'Open',
  removed: 'Removed',
  warned: 'Author warned',
  suspended: 'Author suspended',
  dismissed: 'Dismissed',
};
export const StatusPill = ({ s }: { s: Status }) => (
  <Pill tone={s === 'open' ? 'navy' : s === 'dismissed' ? 'gray' : 'ok'}>{STATUS_TEXT[s]}</Pill>
);

/* ---------- Queue ---------- */

export function Moderation() {
  const { world } = useWorld();
  const { nav } = useStaff();
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open');
  const open = world.tickets.filter((t) => t.status === 'open');
  const resolved = world.tickets.filter((t) => t.status !== 'open');
  const rows = filter === 'open' ? open : filter === 'resolved' ? resolved : world.tickets;

  return (
    <>
      <PageHead title="Moderation" />
      <div className="row g8 wrap" role="group" aria-label="Filter tickets">
        <Chip on={filter === 'open'} onClick={() => setFilter('open')}>
          Open · {open.length}
        </Chip>
        <Chip on={filter === 'resolved'} onClick={() => setFilter('resolved')}>
          Resolved · {resolved.length}
        </Chip>
        <Chip on={filter === 'all'} onClick={() => setFilter('all')}>
          All · {world.tickets.length}
        </Chip>
      </div>
      {rows.length === 0 ? (
        <Empty title={filter === 'open' ? 'Queue is clear' : 'Nothing here'}>
          {filter === 'open'
            ? 'No open reports. New reports from the app land here.'
            : 'No tickets in this view.'}
        </Empty>
      ) : (
        <div className="list">
          {rows.map((t) => (
            <button
              key={t.id}
              onClick={() => nav.go('ticket', { id: t.id })}
              className="row wrap g12"
              style={{
                width: '100%',
                padding: '16px 18px',
                border: 0,
                background: 'var(--surface)',
                textAlign: 'left',
                cursor: 'pointer',
                alignItems: 'center',
              }}
            >
              <span style={{ flex: '0 0 190px' }}>
                <ReasonPill t={t} />
              </span>
              <span className="stack g4" style={{ flex: '1 1 320px' }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>
                  {t.target} · {t.where}
                </span>
                <span className="small">
                  {t.kind} by {t.author} · {t.reports.length} report
                  {t.reports.length === 1 ? '' : 's'} · Ticket #{t.id}
                </span>
              </span>
              {t.status !== 'open' && <StatusPill s={t.status} />}
              <span className="small" style={{ color: 'var(--muted)' }}>
                {t.age} ago
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="tiny">
        Every post, comment and event passes an automatic check before it appears. Reports from
        members come here.
      </div>
    </>
  );
}

/* ---------- Ticket ---------- */

type Act = 'removed' | 'warned' | 'suspended' | 'dismissed';

export function TicketScreen() {
  const { world, update } = useWorld();
  const { nav, toast, local, setLocal } = useStaff();
  const t = world.tickets.find((x) => x.id === nav.params.id);
  const [pick, setPick] = useState<Act | null>(null);
  const [note, setNote] = useState('');
  const [noteErr, setNoteErr] = useState('');

  if (!t)
    return (
      <>
        <Back onClick={nav.back} label="Moderation" />
        <Empty title="Ticket not found" />
      </>
    );

  const who = firstName(t.author);
  const thing = t.kind.toLowerCase();
  const actions: { id: Act; label: string; primary?: boolean }[] = [
    { id: 'removed', label: `Remove the ${thing}`, primary: true },
    { id: 'warned', label: 'Warn the author' },
    { id: 'suspended', label: 'Suspend the author' },
    { id: 'dismissed', label: 'Dismiss, no action' },
  ];
  const msgs: Record<Act, string> = {
    removed: `${t.kind} removed. ${t.reports.length === 1 ? 'The reporter was' : 'All reporters were'} told it was handled.`,
    warned: `Warning sent to ${who}.`,
    suspended: `${who} is suspended and signed out.`,
    dismissed: `Dismissed. The ${thing} stays up.`,
  };
  const log = local.modLog.filter((l) => l.ticketId === t.id);
  const nextOpen = world.tickets.find((x) => x.status === 'open' && x.id !== t.id);

  const apply = () => {
    if (!pick) return;
    if (pick !== 'dismissed' && note.trim().length < 3) {
      setNoteErr('Add a short note for the log. Others will read it later.');
      return;
    }
    setNoteErr('');
    const quoted = /“([^”]+)”/.exec(t.target)?.[1]?.toLowerCase();
    update((w) => ({
      ...w,
      tickets: w.tickets.map((x) => (x.id === t.id ? { ...x, status: pick } : x)),
      // Removing a post hides the matching post everywhere, when we can find it.
      posts:
        pick === 'removed' && t.kind === 'Post' && quoted
          ? w.posts.map((p) => (p.text.toLowerCase().includes(quoted) ? { ...p, hidden: true } : p))
          : w.posts,
    }));
    setLocal((l) => ({
      ...l,
      modLog: [
        ...l.modLog,
        {
          ticketId: t.id,
          action: actions.find((a) => a.id === pick)?.label ?? pick,
          note: note.trim(),
          who: STAFF_NAME,
          when: nowLabel(),
        },
      ],
    }));
    toast(msgs[pick]);
    setPick(null);
    setNote('');
  };
  const reopen = () => {
    update((w) => ({
      ...w,
      tickets: w.tickets.map((x) => (x.id === t.id ? { ...x, status: 'open' } : x)),
    }));
    setLocal((l) => ({
      ...l,
      modLog: [
        ...l.modLog,
        { ticketId: t.id, action: 'Reopened', note: '', who: STAFF_NAME, when: nowLabel() },
      ],
    }));
    toast('Ticket reopened');
  };

  return (
    <div className="row wrap g20" style={{ alignItems: 'flex-start' }}>
      <div className="stack g14" style={{ flex: '999 1 460px' }}>
        <Back onClick={nav.back} label="Moderation" />
        <div className="row g10 wrap">
          <h1 className="display d-40">Ticket #{t.id}</h1>
          <ReasonPill t={t} />
          <StatusPill s={t.status} />
        </div>
        <section className="panel stack g8" style={{ padding: 16, borderRadius: 14 }}>
          <Kicker>Reported {thing}</Kicker>
          <div
            style={{
              fontSize: 16,
              lineHeight: 1.5,
              padding: 12,
              borderRadius: 10,
              background: 'var(--ground)',
            }}
          >
            {t.target}
          </div>
          <div className="small">
            By <b style={{ fontWeight: 600 }}>{t.author}</b> · in {t.where} · passed the automatic
            check · {t.age} ago
          </div>
        </section>
        <section className="panel stack g6" style={{ padding: 16, borderRadius: 14 }}>
          <Kicker>Reports · {t.reports.length}</Kicker>
          {t.reports.map((r, i) => (
            <div key={i} style={{ fontSize: 15 }}>
              {r.by} ·{' '}
              {r.note ? `“${r.note}”` : <span style={{ color: 'var(--muted)' }}>no note</span>}
            </div>
          ))}
        </section>
        {t.status !== 'open' && (
          <div role="status" className="notice-ok row between wrap g10">
            <span>{msgs[t.status as Act]}</span>
            <span className="row g8">
              {nextOpen && (
                <button
                  className="btn btn-navy btn-sm"
                  onClick={() => nav.replace('ticket', { id: nextOpen.id })}
                >
                  Next open ticket
                </button>
              )}
              <button className="btn btn-quiet btn-sm" onClick={nav.back}>
                Back to queue
              </button>
            </span>
          </div>
        )}
        <section className="panel stack g6" style={{ padding: 16, borderRadius: 14 }}>
          <Kicker>Action log</Kicker>
          {log.length === 0 ? (
            <div className="small">
              Nothing yet. Every action is logged with the staff member’s name.
            </div>
          ) : (
            log.map((l, i) => (
              <div key={i} style={{ fontSize: 14 }}>
                <b style={{ fontWeight: 600 }}>{l.when}</b> · {l.who} · {l.action}
                {l.note && <> · “{l.note}”</>}
              </div>
            ))
          )}
        </section>
      </div>

      <aside
        className="panel stack g10"
        style={{ flex: '1 1 300px', padding: 18, borderRadius: 16 }}
        aria-label="Action"
      >
        <Kicker>Action</Kicker>
        {actions.map((a) => {
          const on = pick === a.id;
          return (
            <button
              key={a.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setPick(a.id);
                setNoteErr('');
              }}
              className="btn"
              style={{
                justifyContent: 'flex-start',
                minHeight: 46,
                borderRadius: 10,
                fontSize: 15,
                padding: '0 14px',
                ...(on
                  ? {
                      border: '2px solid var(--navy)',
                      background: 'var(--navy-tint)',
                      color: 'var(--navy-pressed)',
                    }
                  : a.primary
                    ? { background: 'var(--red)', color: '#fff' }
                    : {
                        border: '1.5px solid var(--field-line)',
                        background: '#fff',
                        color: 'var(--ink)',
                      }),
              }}
            >
              {a.label}
            </button>
          );
        })}
        <label
          htmlFor="note"
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '.1em',
            color: 'var(--muted)',
            marginTop: 6,
          }}
        >
          NOTE FOR THE LOG
        </label>
        <textarea
          id="note"
          className={'textarea' + (noteErr ? ' input err' : '')}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            if (noteErr) setNoteErr('');
          }}
          placeholder="What you saw and why you chose this"
        />
        {noteErr && (
          <div className="err-text" role="alert">
            {noteErr}
          </div>
        )}
        <button className="btn btn-navy" disabled={!pick} onClick={apply}>
          {pick
            ? 'Confirm: ' + (actions.find((a) => a.id === pick)?.label ?? '')
            : 'Pick an action'}
        </button>
        {t.status !== 'open' && (
          <button className="btn btn-ghost" onClick={reopen}>
            Reopen ticket
          </button>
        )}
        <div className="tiny">Every action is logged with your name.</div>
      </aside>
    </div>
  );
}
