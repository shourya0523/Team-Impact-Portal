// Team tab: roster (adult and teen views), child profile, coach tools (requests, members, QR, coaches, team details).
import { useState } from 'react';
import { useWorld } from '../../shared/store';
import { Empty, Field, Icon } from '../../shared/ui';
import {
  BackBtn,
  Circle,
  FakeQR,
  ModalBar,
  Notice,
  Options,
  PhoneDialog,
  PhoneIcon,
  Screen,
  Title,
} from '../parts';
import { bumpMembers, patchTeam, setRequest, uid } from '../model';
import { useApp, type Member } from '../state';

/** Athletes on the roster who are not in the shared world (roster-only, no card). */
const EXTRA = [
  { id: 'sofia-p', num: '11', name: 'Sofia Park', pos: 'Forward', year: '2027', phone: false },
  { id: 'nia', num: '22', name: 'Nia Brooks', pos: 'Defender', year: '2029', phone: true },
];

function useRoster() {
  const { world } = useWorld();
  const { me } = useApp();
  const fromWorld = world.athletes
    .filter((a) => a.teamId === me.teamId)
    .map((a) => ({
      id: a.id,
      num: a.num,
      name: a.first + ' ' + a.last,
      pos: a.position,
      year: a.year,
      phone: !!a.phone,
    }));
  return [...fromWorld, ...EXTRA];
}

/* ---------------- Roster ---------------- */
export function Roster() {
  const { me, nav, toast, local } = useApp();
  const { world } = useWorld();
  const team = world.teams.find((t) => t.id === me.teamId);
  const roster = useRoster();
  const teen = me.persona === 'teen';
  if (!team)
    return (
      <Screen tabs>
        <Empty title="No team yet">Join a team to see the roster.</Empty>
      </Screen>
    );
  const kid = local.child;
  const kids = (
    <>
      <div className="sec">{me.persona === 'parent' ? 'Our teammates' : 'Teammates'}</div>
      <div className="row g10 wrap">
        <button
          className="row g10"
          onClick={() => nav.go('child')}
          style={{
            padding: '10px 14px 10px 10px',
            background: '#fff',
            border: me.persona === 'parent' ? '2px solid var(--navy)' : '1px solid var(--line)',
            borderRadius: 14,
            cursor: 'pointer',
            font: 'inherit',
            color: 'var(--ink)',
          }}
        >
          <span
            className="avatar"
            style={{ width: 36, height: 36, background: '#F2E3C6', color: '#6B4A12' }}
          >
            {kid.name[0]}
          </span>
          <span style={{ fontSize: 15, fontWeight: 600 }}>
            {kid.name}, {kid.age}
          </span>
        </button>
        <div
          className="row g10"
          style={{
            padding: '10px 14px 10px 10px',
            background: '#fff',
            border: teen ? '2px solid var(--red)' : '1px solid var(--line)',
            borderRadius: 14,
          }}
        >
          <span
            className="avatar"
            style={{ width: 36, height: 36, background: '#DCE3EF', color: 'var(--navy-pressed)' }}
          >
            S
          </span>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Sam, 15{teen ? ' (you)' : ''}</span>
        </div>
      </div>
    </>
  );
  return (
    <div className="screen" style={{ minHeight: '100%' }}>
      <div style={{ height: 8, background: team.color }} />
      <div className="m-screen tabs" style={{ paddingTop: 44, minHeight: 0, gap: 10 }}>
        <div className="stack g4">
          <div className="sec">
            {team.college.replace(' University', '').toUpperCase()} · DIVISION {team.division}
          </div>
          <Title>{teen ? 'My team' : team.name}</Title>
        </div>
        {teen && (
          <div
            className="row g12"
            style={{ padding: 14, borderRadius: 16, background: 'var(--red)', color: '#fff' }}
          >
            <span
              className="avatar"
              style={{
                width: 48,
                height: 48,
                background: '#fff',
                color: 'var(--red)',
                fontFamily: 'var(--display)',
                fontWeight: 800,
                fontSize: 24,
              }}
            >
              S
            </span>
            <span className="stack" style={{ gap: 2 }}>
              <span style={{ fontSize: 17, fontWeight: 600 }}>Sam · Teammate since Sept</span>
              <span style={{ fontSize: 14, color: 'var(--red-tint)' }}>
                {team.name}’s newest signing
              </span>
            </span>
          </div>
        )}
        {kids}
        <div className="sec" style={{ marginTop: 6 }}>
          Coaches
        </div>
        <div className="card-row" style={{ padding: '10px 12px' }}>
          <Circle name={team.coach} color="var(--ink)" size={40} />
          <div className="stack grow">
            <div style={{ fontSize: 15, fontWeight: 600 }}>{team.coach}</div>
            <div className="tiny">Head coach</div>
          </div>
        </div>
        <div className="sec" style={{ marginTop: 6 }}>
          Athletes · {roster.length}
        </div>
        {teen ? (
          <div className="grid2">
            {roster.map((a) => (
              <div key={a.id} className="panel stack g8" style={{ padding: 12, borderRadius: 14 }}>
                <span className="tile" style={{ width: 44, height: 44, fontSize: 20 }}>
                  {a.num}
                </span>
                <div className="stack" style={{ gap: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{a.name}</div>
                  <div className="tiny">{a.pos}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="list">
            {roster.map((a) => {
              const self = a.name === me.name;
              const phoneOk = a.phone && (a.id !== 'maya' || local.fam.Phone);
              const emailOk = a.id !== 'maya' || local.fam.Email;
              return (
                <div key={a.id} className="row g12" style={{ padding: '10px 12px' }}>
                  <span
                    className="tile"
                    style={{
                      width: 40,
                      height: 40,
                      background: 'var(--ink)',
                      color: 'var(--ground)',
                      fontSize: 18,
                    }}
                  >
                    {a.num}
                  </span>
                  <div className="stack grow" style={{ gap: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>
                      {a.name}
                      {self ? ' (you)' : ''}
                    </div>
                    <div className="tiny">
                      {a.pos} · Class of {a.year}
                    </div>
                  </div>
                  {!self && phoneOk && (
                    <button
                      className="icon-btn"
                      aria-label={'Call ' + a.name}
                      style={{ background: 'var(--navy-tint)', color: 'var(--navy)' }}
                      onClick={() => toast('Opens your phone to call ' + a.name.split(' ')[0])}
                    >
                      <PhoneIcon />
                    </button>
                  )}
                  {!self && emailOk && (
                    <button
                      className="icon-btn"
                      aria-label={'Email ' + a.name}
                      style={{ background: 'var(--navy-tint)', color: 'var(--navy)' }}
                      onClick={() => toast('Opens your email to ' + a.name.split(' ')[0])}
                    >
                      <Icon name="mail" size={18} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {teen && (
          <div className="tiny">
            Athletes’ phone numbers and emails stay hidden on teen accounts.
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Child profile ---------------- */
export function ChildProfile() {
  const { me, nav, toast, local, setLocal } = useApp();
  const { world } = useWorld();
  const team = world.teams.find((t) => t.id === 'ws');
  const [f, setF] = useState(local.child);
  const [tried, setTried] = useState(false);
  const canEdit = me.persona === 'parent';
  const age = Number(f.age);
  const errs = {
    name: !f.name.trim()
      ? 'Enter a first name.'
      : /\s/.test(f.name.trim())
        ? 'First name only.'
        : '',
    age: !Number.isInteger(age) || age < 3 || age > 12 ? 'Enter an age from 3 to 12.' : '',
  };
  const save = () => {
    if (errs.name || errs.age) {
      setTried(true);
      return;
    }
    setLocal((l) => ({
      ...l,
      child: { name: f.name.trim(), age: String(age), interests: f.interests.trim() },
    }));
    toast('Saved');
    nav.back();
  };
  return (
    <Screen style={{ gap: 18 }}>
      <div className="row between">
        <BackBtn label="Team" />
        {canEdit && (
          <button className="btn btn-ghost" onClick={save}>
            Save
          </button>
        )}
      </div>
      <div className="row g16">
        <div
          style={{
            position: 'relative',
            width: 96,
            height: 96,
            borderRadius: '50%',
            background: '#F2E3C6',
            color: '#6B4A12',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--display)',
            fontWeight: 800,
            fontSize: 44,
          }}
        >
          {(f.name || local.child.name)[0]}
          {canEdit && (
            <button
              aria-label="Change photo"
              onClick={() => toast('Photo updated')}
              style={{
                position: 'absolute',
                right: -4,
                bottom: -4,
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: '3px solid var(--ground)',
                background: 'var(--ink)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Icon name="camera" size={18} />
            </button>
          )}
        </div>
        <div className="stack g4">
          <Title>{local.child.name}</Title>
          <div className="small">{team?.name} · Tufts</div>
        </div>
      </div>
      <Notice icon="lock">
        Only {local.child.name}’s team and family can see this. It never appears in search, to
        recruiters, or in the network feed.
      </Notice>
      {canEdit ? (
        <>
          <div className="grid2" style={{ gap: 12 }}>
            <Field label="First name" htmlFor="fn" error={tried ? errs.name : ''}>
              <input
                id="fn"
                className={'input' + (tried && errs.name ? ' err' : '')}
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </Field>
            <Field label="Age" htmlFor="ag" error={tried ? errs.age : ''}>
              <input
                id="ag"
                className={'input' + (tried && errs.age ? ' err' : '')}
                inputMode="numeric"
                value={f.age}
                onChange={(e) => setF({ ...f, age: e.target.value.replace(/\D/g, '').slice(0, 2) })}
              />
            </Field>
          </div>
          <Field label="Interests" optional htmlFor="int">
            <textarea
              id="int"
              className="textarea"
              style={{ minHeight: 110 }}
              value={f.interests}
              onChange={(e) => setF({ ...f, interests: e.target.value })}
            />
          </Field>
          <div className="tiny">
            {local.child.name} doesn’t sign in. You run this profile. We never ask for health or
            medical details.
          </div>
          <button className="btn btn-primary btn-lg btn-full mt-auto" onClick={save}>
            Save
          </button>
        </>
      ) : (
        <div className="list">
          <div className="kv">
            <span>Age</span>
            <span>{local.child.age}</span>
          </div>
          <div className="kv">
            <span>Loves</span>
            <span>{local.child.interests || '—'}</span>
          </div>
          <div className="kv">
            <span>Profile run by</span>
            <span>Dana Kim (parent)</span>
          </div>
        </div>
      )}
    </Screen>
  );
}

/* ---------------- Coach: remove member dialog ---------------- */
function RemoveDialog({ m, onClose }: { m: Member | null; onClose: () => void }) {
  const { me, toast, setLocal } = useApp();
  const { world, update } = useWorld();
  const team = world.teams.find((t) => t.id === me.teamId);
  if (!m) return null;
  const parent = /Parent of (\w+)/.exec(m.detail)?.[1];
  const first = m.name.split(' ')[0];
  return (
    <PhoneDialog open title={'Remove ' + m.name + '?'} onClose={onClose}>
      <div style={{ fontSize: 15, lineHeight: 1.45, color: '#2A2E35' }}>
        {parent
          ? `${first} and ${parent} leave ${team?.name} right away.`
          : `${first} leaves ${team?.name} right away.`}
      </div>
      <div
        className="stack g8"
        style={{
          padding: '12px 14px',
          borderRadius: 12,
          background: 'var(--ground)',
          fontSize: 14,
          lineHeight: 1.4,
        }}
      >
        <div>
          · {first} loses the roster
          {m.detail.startsWith('Teammate') ? '' : ' and athletes’ contacts'}
        </div>
        {parent && <div>· {parent}’s profile is removed from the team</div>}
        <div>
          · Their past posts stay{parent ? `; tagged photos of ${parent} stay team-only` : ''}
        </div>
      </div>
      <div className="tiny">They can ask to join again later. This is logged.</div>
      <div className="grid2">
        <button className="btn btn-quiet" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn-danger"
          onClick={() => {
            setLocal((l) => ({ ...l, members: l.members.filter((x) => x.id !== m.id) }));
            update(bumpMembers(me.teamId ?? 'ws', parent ? -2 : -1));
            toast('Removed ' + m.name);
            onClose();
          }}
        >
          {parent ? 'Remove both' : 'Remove'}
        </button>
      </div>
    </PhoneDialog>
  );
}

/* ---------------- Coach: team ---------------- */
export function CoachTeam() {
  const { me, nav, toast, local, setLocal } = useApp();
  const { world, update } = useWorld();
  const team = world.teams.find((t) => t.id === me.teamId)!;
  const reqs = world.joinRequests.filter((r) => r.teamId === team.id && r.status === 'pending');
  const [rm, setRm] = useState<Member | null>(null);
  const colors: Record<string, string> = {
    athlete: 'var(--navy)',
    parent: '#7A1F2B',
    teen: 'var(--text-2)',
  };
  const decide = (id: string, ok: boolean) => {
    const r = reqs.find((x) => x.id === id);
    if (!r) return;
    update(setRequest(id, ok ? 'approved' : 'declined'));
    if (ok) {
      const m: Member = {
        id: uid('m'),
        name: r.name,
        detail: (r.role === 'athlete' ? 'Athlete · ' : '') + r.detail + ' · approved today',
        color: colors[r.role] ?? 'var(--navy)',
        viaQr: false,
      };
      setLocal((l) => ({ ...l, members: [m, ...l.members.filter((x) => x.name !== r.name)] }));
    }
    toast(ok ? `${r.name} is on the team` : `Declined ${r.name}`);
  };
  return (
    <Screen tabs style={{ padding: '52px 20px 112px', gap: 10 }}>
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <div className="stack" style={{ gap: 2 }}>
          <div className="sec">COACH · {team.name.toUpperCase()}</div>
          <Title>Team</Title>
        </div>
        <button
          className="btn btn-primary btn-sm"
          style={{ borderRadius: 999, minHeight: 40 }}
          onClick={() => nav.go('coachQR')}
        >
          <Icon name="qr" size={18} />
          QR code
        </button>
      </div>
      <div className="row g8">
        <button className="btn btn-quiet btn-sm" onClick={() => nav.go('addCoach')}>
          <Icon name="plus" size={16} />
          Add a coach
        </button>
        <button className="btn btn-quiet btn-sm" onClick={() => nav.go('editTeam')}>
          <Icon name="edit" size={16} />
          Team details
        </button>
      </div>
      <div className="sec" style={{ marginTop: 6 }}>
        Waiting for you · {reqs.length}
      </div>
      {reqs.map((r) => (
        <div key={r.id} className="panel stack g10" style={{ padding: '12px 14px' }}>
          <div className="row g12">
            <Circle name={r.name} color={colors[r.role]} size={40} />
            <div className="stack grow" style={{ gap: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{r.name}</div>
              <div className="tiny">{r.detail}</div>
            </div>
            <span className="pill pill-navy">{r.role.toUpperCase()}</span>
          </div>
          <div className="grid2" style={{ gap: 8 }}>
            <button className="btn btn-navy" onClick={() => decide(r.id, true)}>
              Approve
            </button>
            <button className="btn btn-quiet" onClick={() => decide(r.id, false)}>
              Decline
            </button>
          </div>
        </div>
      ))}
      {!reqs.length && (
        <div className="dashed small" style={{ padding: 16, textAlign: 'center' }}>
          No requests right now. Share your QR code to skip the wait.
        </div>
      )}
      <div className="sec" style={{ marginTop: 6 }}>
        Members · {team.members}
      </div>
      {local.members.map((m) => (
        <div key={m.id} className="card-row" style={{ padding: '10px 12px' }}>
          <Circle name={m.name} color={m.color} size={40} />
          <div className="stack grow" style={{ gap: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{m.name}</div>
            <div className="tiny">{m.detail}</div>
          </div>
          <button
            className="btn btn-sm btn-quiet"
            style={{ color: 'var(--danger)' }}
            onClick={() => setRm(m)}
          >
            Remove
          </button>
        </div>
      ))}
      <div className="tiny">
        Showing recent members. The full roster is in the Team IMPACT staff portal.
      </div>
      <RemoveDialog m={rm} onClose={() => setRm(null)} />
    </Screen>
  );
}

/* ---------------- Coach: QR ---------------- */
export function CoachQR() {
  const { me, toast, local, setLocal } = useApp();
  const { world } = useWorld();
  const team = world.teams.find((t) => t.id === me.teamId)!;
  const [rm, setRm] = useState<Member | null>(null);
  const exp = { night: 'Tonight, 11:59 PM', day: 'Wed, Oct 8', week: 'Tue, Oct 14' }[local.qr.len];
  const joined = local.members.filter((m) => m.viaQr);
  return (
    <Screen style={{ gap: 14 }}>
      <BackBtn label="Team" />
      <div
        className="stack g12"
        style={{
          background: 'var(--navy)',
          color: '#fff',
          borderRadius: 20,
          padding: 18,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--display)',
            fontWeight: 800,
            fontSize: 26,
            textTransform: 'uppercase',
          }}
        >
          Join {team.name}
        </div>
        {local.qr.revoked ? (
          <div
            className="stack g10"
            style={{ alignItems: 'center', padding: '40px 10px', textAlign: 'center' }}
          >
            <Icon name="lock" size={40} />
            <div style={{ fontSize: 16, fontWeight: 600 }}>This code no longer works</div>
            <div style={{ fontSize: 14, color: 'var(--on-navy)' }}>
              Nobody can join with it. Make a new one when you’re ready.
            </div>
          </div>
        ) : (
          <FakeQR />
        )}
        <div style={{ fontSize: 14, color: 'var(--on-navy)' }}>
          {local.qr.revoked
            ? 'Revoked just now'
            : `Expires ${exp} · ${joined.length} people joined`}
        </div>
      </div>
      <fieldset className="field" style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="label" style={{ padding: 0, marginBottom: 6 }}>
          Code works for
        </legend>
        <Options
          center
          cols={3}
          value={local.qr.len}
          onChange={(len) => setLocal((l) => ({ ...l, qr: { ...l.qr, len } }))}
          options={[
            { id: 'night', name: 'Tonight' },
            { id: 'day', name: '1 day' },
            { id: 'week', name: '1 week' },
          ]}
        />
      </fieldset>
      {local.qr.revoked ? (
        <button
          className="btn btn-primary btn-lg btn-full"
          onClick={() => {
            setLocal((l) => ({ ...l, qr: { ...l.qr, revoked: false } }));
            toast('New code ready');
          }}
        >
          Make a new code
        </button>
      ) : (
        <div className="grid2">
          <button className="btn btn-primary" onClick={() => toast('Saved to Photos')}>
            Save as image
          </button>
          <button
            className="btn"
            style={{
              border: '1.5px solid var(--danger)',
              color: 'var(--danger)',
              background: 'transparent',
            }}
            onClick={() => {
              setLocal((l) => ({ ...l, qr: { ...l.qr, revoked: true } }));
              toast('Code revoked');
            }}
          >
            Revoke code
          </button>
        </div>
      )}
      <div className="sec">Joined with this code</div>
      {joined.length ? (
        <div className="list">
          {joined.map((m) => (
            <div key={m.id} className="row between" style={{ padding: '8px 14px', fontSize: 15 }}>
              <span>
                <b style={{ fontWeight: 600 }}>{m.name}</b> · {m.detail.split(' · ')[0]}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--danger)' }}
                onClick={() => setRm(m)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="small">Nobody has used this code yet.</div>
      )}
      <RemoveDialog m={rm} onClose={() => setRm(null)} />
    </Screen>
  );
}

/* ---------------- Coach: add a coach ---------------- */
export function AddCoach() {
  const { nav, toast, local, setLocal } = useApp();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'Head coach' | 'Assistant coach'>('Assistant coach');
  const [tried, setTried] = useState(false);
  const err = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ? 'Enter their email address.'
    : local.coaches.some((c) => c.name === email.trim())
      ? 'You already invited them.'
      : '';
  const send = () => {
    if (err) {
      setTried(true);
      return;
    }
    setLocal((l) => ({
      ...l,
      coaches: [
        ...l.coaches,
        {
          name: email.trim(),
          role: role === 'Head coach' ? 'Head coach' : 'Assistant',
          note: 'Invite sent today · not accepted yet',
        },
      ],
    }));
    toast('Invite sent');
    nav.back();
  };
  return (
    <Screen style={{ gap: 14 }}>
      <BackBtn label="Team" />
      <Title>Add a coach</Title>
      <div className="sec">Coaches · {local.coaches.length}</div>
      <div className="list">
        {local.coaches.map((c) => (
          <div key={c.name} className="row g12" style={{ padding: '12px 14px' }}>
            <Circle
              name={c.name}
              color={c.note.startsWith('Invite') ? 'var(--muted)' : 'var(--ink)'}
              size={38}
            />
            <div className="stack">
              <div style={{ fontSize: 15, fontWeight: 600 }}>
                {c.name} · {c.role}
              </div>
              <div className="tiny">{c.note}</div>
            </div>
          </div>
        ))}
      </div>
      <Field label="Their email" htmlFor="ce" error={tried ? err : ''}>
        <input
          id="ce"
          type="email"
          className={'input' + (tried && err ? ' err' : '')}
          placeholder="coach@tufts.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <fieldset className="field" style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="label" style={{ padding: 0, marginBottom: 5 }}>
          Role
        </legend>
        <Options
          center
          value={role}
          onChange={setRole}
          options={[
            { id: 'Head coach', name: 'Head coach' },
            { id: 'Assistant coach', name: 'Assistant coach' },
          ]}
        />
      </fieldset>
      <p className="small" style={{ margin: 0 }}>
        They get the same team tools you have. Team IMPACT keeps a record of who added whom.
      </p>
      <button className="btn btn-primary btn-lg btn-full mt-auto" onClick={send}>
        Send invite
      </button>
    </Screen>
  );
}

/* ---------------- Coach: edit team ---------------- */
const TCOLORS = [
  ['Navy', '#1E3F7B'],
  ['Red', '#D0213C'],
  ['Green', '#0F7B5F'],
  ['Maroon', '#7A1F2B'],
] as const;
export function EditTeam() {
  const { me, nav, toast, local, setLocal } = useApp();
  const { world, update } = useWorld();
  const team = world.teams.find((t) => t.id === me.teamId)!;
  const [name, setName] = useState(team.name);
  const [color, setColor] = useState(team.color);
  const [about, setAbout] = useState(local.teamAbout);
  const [tried, setTried] = useState(false);
  const err = !name.trim() ? 'The team needs a name.' : '';
  const save = () => {
    if (err) {
      setTried(true);
      return;
    }
    update(patchTeam(team.id, { name: name.trim(), color }));
    setLocal((l) => ({ ...l, teamAbout: about }));
    toast('Team details saved');
    nav.back();
  };
  return (
    <Screen style={{ gap: 14 }}>
      <ModalBar
        title="Team details"
        onCancel={nav.back}
        action={
          <button className="btn btn-ghost" style={{ color: 'var(--red)' }} onClick={save}>
            Save
          </button>
        }
      />
      <div className="row g14">
        <span
          className="tile"
          style={{ width: 72, height: 72, borderRadius: 16, background: color, fontSize: 28 }}
        >
          {team.abbr}
        </span>
        <button className="btn btn-quiet btn-sm" onClick={() => toast('Team photo updated')}>
          Change team photo
        </button>
      </div>
      <Field label="Team name" htmlFor="tn" error={tried ? err : ''}>
        <input
          id="tn"
          className={'input' + (tried && err ? ' err' : '')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <div className="grid2">
        <div className="field">
          <span className="label">College</span>
          <div
            className="input"
            style={{
              background: 'var(--line-soft)',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-2)',
              border: 0,
            }}
          >
            {team.college.replace(' University', '')}
          </div>
        </div>
        <div className="field">
          <span className="label">Division</span>
          <div
            className="input"
            style={{
              background: 'var(--line-soft)',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-2)',
              border: 0,
            }}
          >
            {team.division}
          </div>
        </div>
      </div>
      <fieldset className="field" style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="label" style={{ padding: 0, marginBottom: 6 }}>
          Team color
        </legend>
        <div className="row g10">
          {TCOLORS.map(([n, c]) => (
            <button
              key={c}
              aria-label={n}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: color === c ? '3px solid var(--ink)' : 0,
                background: c,
                cursor: 'pointer',
                boxShadow: color === c ? 'inset 0 0 0 3px #fff' : undefined,
              }}
            />
          ))}
        </div>
      </fieldset>
      <Field label="About the team" htmlFor="ta">
        <textarea
          id="ta"
          className="textarea"
          value={about}
          onChange={(e) => setAbout(e.target.value)}
        />
      </Field>
      <div className="tiny">
        College and division are set by Team IMPACT. Ask them to change these.
      </div>
    </Screen>
  );
}
