import { useState } from 'react';
import { useWorld } from '../../shared/store';
import type { Team } from '../../shared/data';
import { Back, Empty, Field, Icon, Pill, Tile } from '../../shared/ui';
import { Box, H2, LinkBtn, PageHead, Stat, StatGrid } from '../kit';
import { EMAIL_RE, initials, uid, useStaff, type Coach } from '../state';

/* ---------- status helpers ---------- */

type Status = 'live' | 'invited' | 'requested';
export const teamStatus = (t: Team): Status =>
  !t.registered ? 'requested' : t.members === 0 ? 'invited' : 'live';
const StatusPill = ({ t }: { t: Team }) => {
  const s = teamStatus(t);
  return s === 'live' ? (
    <Pill tone="ok">Live</Pill>
  ) : s === 'invited' ? (
    <Pill tone="warn">Coach invited</Pill>
  ) : (
    <Pill tone="gray">Requested · not set up</Pill>
  );
};
const collegeShort = (c: string) => c.replace(' University', '').replace('University of ', '');

/* ---------- Teams list ---------- */

export function Teams() {
  const { world } = useWorld();
  const { nav, local } = useStaff();
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const rows = world.teams.filter(
    (t) =>
      !term ||
      (t.name + ' ' + t.college + ' ' + t.coach + ' ' + t.sport).toLowerCase().includes(term),
  );
  const coachesOf = (t: Team) => {
    if (!t.registered) return 'No coach yet';
    const extra = (local.coaches[t.id] ?? []).map((c) => c.name);
    if (teamStatus(t) === 'invited') return 'Invite sent to ' + t.coach;
    return [t.coach, ...extra].join(', ');
  };

  return (
    <>
      <PageHead
        title="Teams"
        action={
          <button className="btn btn-primary" onClick={() => nav.go('createTeam')}>
            <Icon name="plus" size={18} />
            Create team
          </button>
        }
      />
      <div className="row g10 wrap">
        <label htmlFor="team-q" className="sr-only">
          Search teams
        </label>
        <div className="row g8" style={{ flex: '1 1 320px', maxWidth: 440, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 14, color: 'var(--muted)', display: 'flex' }}>
            <Icon name="search" size={18} />
          </span>
          <input
            id="team-q"
            className="input"
            placeholder="Search by team, college or coach"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 42 }}
          />
        </div>
        <span className="tiny">
          {world.teams.filter((t) => t.registered).length} set up ·{' '}
          {world.teams.filter((t) => !t.registered).length} requested
        </span>
      </div>
      {rows.length === 0 ? (
        <Empty
          title="No teams match"
          action={
            <button className="btn btn-outline" onClick={() => setQ('')}>
              Clear search
            </button>
          }
        >
          Try a college name or a coach.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="t" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th>Team</th>
                <th>College</th>
                <th>Coaches</th>
                <th>Members</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className="row g10">
                      <Tile team={t} size={32} />
                      <LinkBtn onClick={() => nav.go('team', { id: t.id })}>{t.name}</LinkBtn>
                    </div>
                  </td>
                  <td>{collegeShort(t.college)}</td>
                  <td className="small">{coachesOf(t)}</td>
                  <td>{t.members}</td>
                  <td>
                    <StatusPill t={t} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {t.registered ? (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => nav.go('team', { id: t.id })}
                      >
                        Open
                      </button>
                    ) : (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => nav.go('createTeam', { from: t.id })}
                      >
                        Set up
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ---------- Create team ---------- */

const SWATCHES = [
  { hex: '#D0213C', name: 'Red' },
  { hex: '#1E3F7B', name: 'Navy' },
  { hex: '#0F7B5F', name: 'Green' },
  { hex: '#7A1F2B', name: 'Maroon' },
  { hex: '#4A4F57', name: 'Gray' },
  { hex: '#8A4A00', name: 'Brown' },
];

export function CreateTeam() {
  const { world, update } = useWorld();
  const { nav, toast } = useStaff();
  const from = world.teams.find((t) => t.id === nav.params.from);
  const [f, setF] = useState({
    college: from?.college ?? 'Tufts University',
    sport: from?.name ?? '',
    division: from?.division ?? 'III',
    region: 'Northeast',
    color: from?.color ?? '#D0213C',
    coach: '',
    email: '',
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!f.college.trim()) er.college = 'Add the college.';
    if (!f.sport.trim()) er.sport = 'Add the team, like Women’s Rowing.';
    else if (
      world.teams.some(
        (t) =>
          t.registered &&
          t.id !== from?.id &&
          t.name.toLowerCase() === f.sport.trim().toLowerCase() &&
          t.college.toLowerCase() === f.college.trim().toLowerCase(),
      )
    )
      er.sport = 'This college already has that team.';
    if (!f.coach.trim()) er.coach = 'Add the first coach’s name.';
    if (!f.email.trim()) er.email = 'Add the coach’s email.';
    else if (!EMAIL_RE.test(f.email.trim()))
      er.email = 'Check the email. It should look like name@school.edu.';
    setErrs(er);
    if (Object.keys(er).length) return;
    const id = from?.id ?? uid('t');
    const team: Team = {
      id,
      name: f.sport.trim(),
      abbr: initials(f.sport.trim()),
      college: f.college.trim(),
      sport: f.sport.trim(),
      division: f.division,
      color: f.color,
      coach: f.coach.trim(),
      registered: true,
      members: 0,
    };
    update((w) => ({
      ...w,
      teams: from ? w.teams.map((t) => (t.id === id ? team : t)) : [...w.teams, team],
    }));
    toast('Invite sent to ' + f.coach.trim());
    nav.replace('team', { id, sent: '1' });
  };

  return (
    <form className="stack g16" onSubmit={submit} noValidate style={{ maxWidth: 760 }}>
      <Back onClick={nav.back} label="Teams" />
      <PageHead title={from ? 'Set up ' + from.name : 'Create a team'} />
      {from && (
        <div className="tint">This team was requested by members. Add a coach to set it up.</div>
      )}
      <div className="grid2" style={{ gap: 14 }}>
        <Field label="College" htmlFor="c1" error={errs.college}>
          <input
            id="c1"
            className={'input' + (errs.college ? ' err' : '')}
            value={f.college}
            onChange={set('college')}
          />
        </Field>
        <Field
          label="Sport"
          htmlFor="c2"
          error={errs.sport}
          hint="As the team calls itself, like Women’s Rowing."
        >
          <input
            id="c2"
            className={'input' + (errs.sport ? ' err' : '')}
            value={f.sport}
            onChange={set('sport')}
            placeholder="Baseball"
          />
        </Field>
        <Field label="Division" htmlFor="c3">
          <select id="c3" className="select" value={f.division} onChange={set('division')}>
            <option value="I">Division I</option>
            <option value="II">Division II</option>
            <option value="III">Division III</option>
          </select>
        </Field>
        <Field label="Region" htmlFor="c4">
          <select id="c4" className="select" value={f.region} onChange={set('region')}>
            <option>Northeast</option>
            <option>Mid-Atlantic</option>
            <option>Midwest</option>
            <option>South</option>
            <option>West</option>
          </select>
        </Field>
      </div>
      <fieldset className="stack g8" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 8 }}>
          Team color
        </legend>
        <div className="row g8 wrap">
          {SWATCHES.map((s) => (
            <button
              key={s.hex}
              type="button"
              aria-label={s.name}
              aria-pressed={f.color === s.hex}
              onClick={() => setF({ ...f, color: s.hex })}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: s.hex,
                cursor: 'pointer',
                border: f.color === s.hex ? '3px solid var(--ink)' : '3px solid transparent',
                boxShadow: 'inset 0 0 0 2px #fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              {f.color === s.hex && <Icon name="check" size={18} />}
            </button>
          ))}
          <span className="row g8" style={{ marginLeft: 8 }}>
            <Tile team={{ abbr: initials(f.sport || 'Team'), color: f.color }} size={40} />
            <span className="tiny">Preview</span>
          </span>
        </div>
      </fieldset>
      <Box gap={14}>
        <H2>First coach</H2>
        <div className="grid2" style={{ gap: 14 }}>
          <Field label="Name" htmlFor="c5" error={errs.coach}>
            <input
              id="c5"
              className={'input' + (errs.coach ? ' err' : '')}
              value={f.coach}
              onChange={set('coach')}
              placeholder="Alex Park"
              autoComplete="off"
            />
          </Field>
          <Field label="Email" htmlFor="c6" error={errs.email}>
            <input
              id="c6"
              type="email"
              className={'input' + (errs.email ? ' err' : '')}
              value={f.email}
              onChange={set('email')}
              placeholder="alex.park@tufts.edu"
              autoComplete="off"
            />
          </Field>
        </div>
        <div className="small">
          They get an invite link. Once they accept, they can approve members, make QR codes and add
          other coaches.
        </div>
      </Box>
      <div className="row g10 wrap">
        <button type="submit" className="btn btn-primary btn-lg">
          Create team and send invite
        </button>
        <button type="button" className="btn btn-quiet btn-lg" onClick={nav.back}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ---------- Team detail ---------- */

export function TeamDetail() {
  const { world, update } = useWorld();
  const { nav, toast, local, setLocal } = useStaff();
  const t = world.teams.find((x) => x.id === nav.params.id);
  const [inviting, setInviting] = useState(false);
  const [inv, setInv] = useState({ name: '', email: '' });
  const [invErr, setInvErr] = useState<Record<string, string>>({});
  const [showLog, setShowLog] = useState(false);

  if (!t)
    return (
      <>
        <Back onClick={nav.back} label="Teams" />
        <Empty title="Team not found">It may have been removed.</Empty>
      </>
    );

  const status = teamStatus(t);
  const reqs = world.joinRequests.filter((r) => r.teamId === t.id);
  const pending = reqs.filter((r) => r.status === 'pending');
  const extra = local.coaches[t.id] ?? [];
  const cards = world.athletes.filter((a) => a.teamId === t.id && a.published).length;

  const decide = (id: string, status: 'approved' | 'declined') => {
    const r = reqs.find((x) => x.id === id);
    update((w) => ({
      ...w,
      joinRequests: w.joinRequests.map((x) => (x.id === id ? { ...x, status } : x)),
      teams:
        status === 'approved'
          ? w.teams.map((x) => (x.id === t.id ? { ...x, members: x.members + 1 } : x))
          : w.teams,
    }));
    toast(
      (r?.name ?? 'Request') +
        (status === 'approved' ? ' approved. They can now see the team.' : ' declined.'),
    );
  };

  const addCoach = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!inv.name.trim()) er.name = 'Add a name.';
    if (!EMAIL_RE.test(inv.email.trim()))
      er.email = 'Check the email. It should look like name@school.edu.';
    setInvErr(er);
    if (Object.keys(er).length) return;
    const c: Coach = {
      name: inv.name.trim(),
      email: inv.email.trim(),
      role: 'Assistant · invited',
      added: 'added by staff (Alex M.), today',
    };
    setLocal((l) => ({ ...l, coaches: { ...l.coaches, [t.id]: [...(l.coaches[t.id] ?? []), c] } }));
    toast('Invite sent to ' + c.name);
    setInv({ name: '', email: '' });
    setInviting(false);
  };

  return (
    <>
      <Back onClick={nav.back} label="Teams" />
      <PageHead
        eyebrow={`${t.college.replace(' University', '').toUpperCase()} · DIVISION ${t.division} · NORTHEAST`}
        title={t.name}
        action={
          status === 'invited' ? (
            <button
              className="btn btn-outline"
              onClick={() => toast('Invite resent to ' + t.coach)}
            >
              Resend invite
            </button>
          ) : undefined
        }
      />
      {nav.params.sent === '1' && status === 'invited' && (
        <div className="notice-ok" role="status">
          Team created. Invite sent to {t.coach}. The team goes live when they accept.
        </div>
      )}
      {!t.registered && (
        <div className="notice-warn row g10 wrap between">
          <span>Members asked for this team, but no coach has been set up yet.</span>
          <button
            className="btn btn-navy btn-sm"
            onClick={() => nav.go('createTeam', { from: t.id })}
          >
            Set up team
          </button>
        </div>
      )}
      <StatGrid min={180}>
        <Stat label="Members" value={t.members} />
        <Stat label="Coaches" value={t.registered ? 1 + extra.length : 0} />
        <Stat label="Cards published" value={cards} />
        <Stat label="Pending requests" value={pending.length} />
      </StatGrid>

      <div className="row wrap g16" style={{ alignItems: 'stretch' }}>
        <Box style={{ flex: '1 1 340px' }}>
          <H2>Coaches</H2>
          {t.registered ? (
            <>
              <div style={{ fontSize: 15 }}>
                <b style={{ fontWeight: 600 }}>{t.coach}</b> · Head coach ·{' '}
                {status === 'invited'
                  ? 'invite sent, not accepted yet'
                  : 'added by staff (Kelly M.)'}
              </div>
              {extra.map((c) => (
                <div key={c.email} style={{ fontSize: 15 }}>
                  <b style={{ fontWeight: 600 }}>{c.name}</b> · {c.role} · {c.added}
                </div>
              ))}
              {inviting ? (
                <form className="stack g10" onSubmit={addCoach} noValidate>
                  <Field label="Name" htmlFor="ic-n" error={invErr.name}>
                    <input
                      id="ic-n"
                      className={'input' + (invErr.name ? ' err' : '')}
                      value={inv.name}
                      onChange={(e) => setInv({ ...inv, name: e.target.value })}
                    />
                  </Field>
                  <Field label="Email" htmlFor="ic-e" error={invErr.email}>
                    <input
                      id="ic-e"
                      type="email"
                      className={'input' + (invErr.email ? ' err' : '')}
                      value={inv.email}
                      onChange={(e) => setInv({ ...inv, email: e.target.value })}
                    />
                  </Field>
                  <div className="row g8">
                    <button className="btn btn-navy btn-sm" type="submit">
                      Send invite
                    </button>
                    <button
                      className="btn btn-quiet btn-sm"
                      type="button"
                      onClick={() => {
                        setInviting(false);
                        setInvErr({});
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  className="btn btn-ghost"
                  style={{ alignSelf: 'flex-start', paddingLeft: 0 }}
                  onClick={() => setInviting(true)}
                >
                  Invite another coach
                </button>
              )}
            </>
          ) : (
            <div className="small">No coach yet.</div>
          )}
        </Box>
        <Box style={{ flex: '1 1 340px' }}>
          <H2>QR codes</H2>
          {status === 'live' ? (
            <>
              <div style={{ fontSize: 15 }}>
                <b style={{ fontWeight: 600 }}>Active</b> · expires Oct 14 · 9 joined
              </div>
              <div style={{ fontSize: 15, color: 'var(--muted)' }}>Revoked · Sep 30 · 4 joined</div>
              <button
                className="btn btn-ghost"
                style={{ alignSelf: 'flex-start', paddingLeft: 0 }}
                aria-expanded={showLog}
                onClick={() => setShowLog((s) => !s)}
              >
                {showLog ? 'Hide join log' : 'See join log'}
              </button>
              {showLog && (
                <div className="list">
                  {[
                    ...reqs
                      .filter((r) => r.status === 'approved')
                      .map((r) => ({
                        k: r.id,
                        txt: `${r.name} · ${r.role} · approved by staff · today`,
                      })),
                    { k: 'l1', txt: 'Grace Liu · athlete · scanned the active code · Oct 3' },
                    { k: 'l2', txt: 'Maya Okafor · athlete · scanned the active code · Oct 2' },
                  ].map((x) => (
                    <div key={x.k} className="small" style={{ padding: '10px 14px' }}>
                      {x.txt}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="small">
              No QR codes yet. The coach makes them after accepting the invite.
            </div>
          )}
        </Box>
      </div>

      <Box>
        <div className="row between wrap g8">
          <H2>Join requests</H2>
          <span className="tiny">Coaches usually approve these. Staff can step in.</span>
        </div>
        {reqs.length === 0 ? (
          <div className="small">No join requests for this team.</div>
        ) : (
          <div className="list">
            {reqs.map((r) => (
              <div key={r.id} className="row g12 wrap" style={{ padding: '12px 14px' }}>
                <div className="stack g4 grow">
                  <div style={{ fontWeight: 600 }}>
                    {r.name}{' '}
                    <span className="tiny">
                      ·{' '}
                      {r.role === 'teen'
                        ? 'Teen (13–17)'
                        : r.role === 'parent'
                          ? 'Parent'
                          : 'Athlete'}
                    </span>
                  </div>
                  <div className="tiny">{r.detail}</div>
                </div>
                {r.status === 'pending' ? (
                  <div className="row g8">
                    <button
                      className="btn btn-navy btn-sm"
                      onClick={() => decide(r.id, 'approved')}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-quiet btn-sm"
                      onClick={() => decide(r.id, 'declined')}
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <Pill tone={r.status === 'approved' ? 'ok' : 'gray'}>
                    {r.status === 'approved' ? 'Approved' : 'Declined'}
                  </Pill>
                )}
              </div>
            ))}
          </div>
        )}
      </Box>
    </>
  );
}
