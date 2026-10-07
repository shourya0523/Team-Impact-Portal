// Me tab (all roles), contacts and recruiting, account and safety, alumni browse and profile.
import { useState } from 'react';
import { useWorld } from '../../shared/store';
import { Empty, Icon, Switch } from '../../shared/ui';
import { BackBtn, Circle, InkChip, Notice, PhoneSheet, Screen, Title } from '../parts';
import { initials, patchAthlete, type Screen as ScreenId } from '../model';
import { useApp, type Local } from '../state';

type Row = {
  label: string;
  value?: string;
  go?: [ScreenId, Record<string, string>?];
  act?: () => void;
};

export function Me() {
  const { me, nav, local, become } = useApp();
  const { world } = useWorld();
  const team = world.teams.find((t) => t.id === me.teamId);
  const maya = world.athletes.find((a) => a.id === 'maya');
  const joined = world.groups.filter((g) => g.joined).length;
  const company = world.companies.find((c) => c.id === 'northbeam');
  const sub =
    me.persona === 'recruiter'
      ? `Recruiter · ${company?.name}`
      : me.persona === 'alumni'
        ? 'Alumni · Tufts ’17 · Swimming'
        : `${me.roleLabel} · ${team?.name ?? ''} · Tufts`;
  const safety: Row[] = [
    { label: 'Notifications', go: ['safety'] },
    { label: 'Blocked people', value: String(local.blocked.length), go: ['safety'] },
    { label: 'Delete account', go: ['safety'] },
  ];
  const first: Row[] =
    me.persona === 'athlete'
      ? [
          {
            label: 'Contacts for families',
            value:
              (['Phone', 'Email', 'LinkedIn'] as const).filter((k) => local.fam[k]).join(', ') ||
              'None',
            go: ['recruiting'],
          },
          {
            label: 'Open to recruiting',
            value: maya?.openToRecruiting ? 'On' : 'Off',
            go: ['recruiting'],
          },
          { label: 'My groups', value: String(joined), go: ['groups'] },
          { label: 'Alumni who help', go: ['alumni'] },
          { label: 'Card history', go: ['history'] },
        ]
      : me.persona === 'parent'
        ? [
            {
              label: local.child.name + '’s profile',
              value: 'Age ' + local.child.age,
              go: ['child'],
            },
            { label: 'My groups', value: String(joined), go: ['groups'] },
          ]
        : me.persona === 'teen'
          ? [{ label: 'My groups', value: String(joined), go: ['groups'] }]
          : me.persona === 'coach'
            ? [
                { label: 'Team details', value: team?.name, go: ['editTeam'] },
                { label: 'Coaches', value: String(local.coaches.length), go: ['addCoach'] },
                { label: 'Join QR code', value: local.qr.revoked ? 'Off' : 'On', go: ['coachQR'] },
                { label: 'My groups', value: String(joined), go: ['groups'] },
              ]
            : me.persona === 'alumni'
              ? [
                  { label: 'Alumni who help', go: ['alumni'] },
                  { label: 'My groups', value: String(joined), go: ['groups'] },
                  { label: 'Claim a pre-built card', go: ['alumniInvite'] },
                ]
              : [
                  { label: 'Company', value: company?.name },
                  {
                    label: 'Saved lists',
                    value: String(world.lists.filter((l) => l.companyId === 'northbeam').length),
                    go: ['lists'],
                  },
                  {
                    label: 'Desktop portal',
                    value: 'Search, notes, sharing',
                    act: () => {
                      location.hash = '#/portal';
                    },
                  },
                ];
  const Group = ({ rows }: { rows: Row[] }) => (
    <div className="list">
      {rows.map((r) =>
        r.go || r.act ? (
          <button
            key={r.label}
            className="lrow"
            onClick={() => (r.act ? r.act() : r.go && nav.go(r.go[0], r.go[1] ?? {}))}
            style={r.label === 'Delete account' ? { color: 'var(--danger)' } : undefined}
          >
            <span className="grow">{r.label}</span>
            {r.value && <span className="v">{r.value}</span>}
            <Icon name="next" size={18} />
          </button>
        ) : (
          <div key={r.label} className="lrow" style={{ cursor: 'default' }}>
            <span className="grow">{r.label}</span>
            <span className="v">{r.value}</span>
          </div>
        ),
      )}
    </div>
  );
  return (
    <Screen tabs style={{ padding: '52px 20px 112px', gap: 16 }}>
      <div className="row g14">
        <span
          className="avatar"
          style={{
            width: 64,
            height: 64,
            fontFamily: 'var(--display)',
            fontWeight: 800,
            fontSize: 28,
            background: me.color,
          }}
        >
          {initials(me.name)}
        </span>
        <div className="stack" style={{ gap: 2 }}>
          <div className="display d-32" style={{ lineHeight: 1 }}>
            {me.name}
          </div>
          <div className="small" style={{ color: 'var(--muted)' }}>
            {sub}
          </div>
        </div>
      </div>
      {me.persona === 'teen' && (
        <Notice icon="lock">
          Your profile is only seen by your team and family. Athletes’ contact details stay hidden
          on teen accounts.
        </Notice>
      )}
      <Group rows={first} />
      <Group rows={safety} />
      <button className="btn btn-ghost btn-full" onClick={() => become('new')}>
        Sign out
      </button>
    </Screen>
  );
}

/* ---------------- Contacts and recruiting ---------------- */
export function Recruiting() {
  const { nav, toast, local, setLocal } = useApp();
  const { world, update } = useWorld();
  const maya = world.athletes.find((a) => a.id === 'maya')!;
  const official = world.groups.filter((g) => g.official && g.joined);
  const chips = (key: 'fam' | 'rec') => (
    <div className="row g8">
      {(['Phone', 'Email', 'LinkedIn'] as const).map((k) => (
        <button
          key={k}
          className="choice c"
          style={{ flex: 1 }}
          aria-pressed={local[key][k]}
          onClick={() => setLocal((l: Local) => ({ ...l, [key]: { ...l[key], [k]: !l[key][k] } }))}
        >
          {k}
        </button>
      ))}
    </div>
  );
  return (
    <Screen style={{ gap: 12 }}>
      <BackBtn label="Me" />
      <Title size={36}>Who can reach you</Title>
      <div className="sec">Families on my team see</div>
      {chips('fam')}
      <div className="tiny">Teen teammates never see your contact details.</div>
      <div className="panel row g14" style={{ padding: 14, marginTop: 6 }}>
        <div className="stack g4 grow">
          <div style={{ fontSize: 16, fontWeight: 600 }}>Open to recruiting</div>
          <div className="tiny" style={{ color: 'var(--text-2)' }}>
            {maya.published
              ? 'Partner recruiters can find your published card. Off means you don’t appear at all.'
              : 'Publish your card first. Until then recruiters can’t see you.'}
          </div>
        </div>
        <Switch
          label="Open to recruiting"
          checked={maya.openToRecruiting}
          disabled={!maya.published}
          onChange={(on) => {
            update(patchAthlete('maya', { openToRecruiting: on }));
            toast(on ? 'Recruiters can now find your card' : 'You’re hidden from recruiters');
          }}
        />
      </div>
      {!maya.published && (
        <button className="btn btn-outline" onClick={() => nav.go('card')}>
          Go to my card
        </button>
      )}
      {maya.openToRecruiting && (
        <div className="stack g10">
          <div className="sec">Recruiters see</div>
          {chips('rec')}
          <div className="sec" style={{ marginTop: 4 }}>
            Find me through official groups
          </div>
          {official.length ? (
            <div className="list">
              {official.map((g) => (
                <label
                  key={g.id}
                  className="check"
                  style={{
                    minHeight: 50,
                    padding: '0 14px',
                    alignItems: 'center',
                    fontWeight: 600,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={maya.groups.includes(g.id)}
                    onChange={(e) => {
                      const groups = e.target.checked
                        ? [...maya.groups, g.id]
                        : maya.groups.filter((x) => x !== g.id);
                      update(patchAthlete('maya', { groups, identityOptIn: groups.length > 0 }));
                    }}
                  />
                  {g.name}
                </label>
              ))}
            </div>
          ) : (
            <div className="small">You haven’t joined any official groups.</div>
          )}
          <div className="tiny">
            Only groups you’ve joined that Team IMPACT marked official. Change this any time.
          </div>
        </div>
      )}
    </Screen>
  );
}

/* ---------------- Account and safety ---------------- */
export function Safety() {
  const { me, toast, local, setLocal, become } = useApp();
  const { update } = useWorld();
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState('');
  const [tried, setTried] = useState(false);
  const prefs: [keyof Local['prefs'], string][] = [
    ['approvals', me.persona === 'coach' ? 'Join requests' : 'Join approvals'],
    ['replies', 'Replies to my posts'],
    ['events', 'Events I’m going to'],
    ['digest', 'Weekly email digest'],
  ];
  const del = () => {
    if (typed.trim().toUpperCase() !== 'DELETE') {
      setTried(true);
      return;
    }
    if (me.persona === 'athlete')
      update(patchAthlete('maya', { published: false, openToRecruiting: false }));
    setConfirm(false);
    become('new');
    toast('Account deleted. Everything is erased in 30 days.');
  };
  return (
    <Screen style={{ gap: 12 }}>
      <BackBtn label="Back" />
      <Title size={36}>Account and safety</Title>
      <div className="sec">Notify me about</div>
      <div className="list">
        {prefs.map(([k, label]) => (
          <label
            key={k}
            className="row g12"
            style={{
              minHeight: 50,
              padding: '0 14px',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <span className="grow">{label}</span>
            <input
              type="checkbox"
              checked={local.prefs[k]}
              onChange={(e) =>
                setLocal((l) => ({ ...l, prefs: { ...l.prefs, [k]: e.target.checked } }))
              }
              style={{ width: 22, height: 22, margin: 0, accentColor: 'var(--navy)' }}
            />
          </label>
        ))}
      </div>
      <div className="sec" style={{ marginTop: 4 }}>
        Blocked
      </div>
      {local.blocked.length ? (
        <div className="list">
          {local.blocked.map((b) => (
            <div key={b} className="row g12" style={{ padding: '8px 14px' }}>
              <Circle name={b} size={36} color="var(--text-2)" />
              <span className="grow" style={{ fontWeight: 600 }}>
                {b}
              </span>
              <button
                className="btn btn-sm btn-quiet"
                onClick={() => {
                  setLocal((l) => ({ ...l, blocked: l.blocked.filter((x) => x !== b) }));
                  toast('Unblocked ' + b);
                }}
              >
                Unblock
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel small" style={{ padding: 14 }}>
          You haven’t blocked anyone. Block someone from any of their posts; they won’t be able to
          see or reply to yours.
        </div>
      )}
      <div className="sec" style={{ marginTop: 4 }}>
        Delete account
      </div>
      <div
        className="panel stack g10"
        style={{ padding: 14, borderColor: '#F2C2C9', borderWidth: 1.5 }}
      >
        <div style={{ fontSize: 15, lineHeight: 1.45 }}>
          Your account is hidden right away and everything is erased after 30 days.
          {me.persona === 'athlete'
            ? ' Your card and posts go with it.'
            : me.persona === 'parent'
              ? ` ${local.child.name}’s profile goes with it.`
              : ''}
        </div>
        <button
          className="btn"
          style={{
            border: '1.5px solid var(--danger)',
            color: 'var(--danger)',
            background: 'transparent',
          }}
          onClick={() => {
            setConfirm(true);
            setTyped('');
            setTried(false);
          }}
        >
          Delete my account
        </button>
      </div>
      <PhoneSheet open={confirm} onClose={() => setConfirm(false)} label="Delete account">
        <h2 className="display d-28" style={{ color: 'var(--danger)' }}>
          Delete your account?
        </h2>
        <p className="small" style={{ margin: 0 }}>
          This can’t be undone after 30 days. Type DELETE to confirm.
        </p>
        <label htmlFor="del" className="label">
          Type DELETE
        </label>
        <input
          id="del"
          className={'input' + (tried ? ' err' : '')}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />
        {tried && (
          <div className="err-text" role="alert">
            Type DELETE to confirm.
          </div>
        )}
        <button className="btn btn-danger btn-lg btn-full" onClick={del}>
          Delete my account
        </button>
        <button className="btn btn-ghost btn-full" onClick={() => setConfirm(false)}>
          Keep my account
        </button>
      </PhoneSheet>
    </Screen>
  );
}

/* ---------------- Alumni ---------------- */
const ACOL = ['var(--navy)', '#0F7B5F', '#7A1F2B', 'var(--text-2)'];
export function AlumniBrowse() {
  const { me, nav } = useApp();
  const { world } = useWorld();
  const [f, setF] = useState<'All' | 'Mentoring' | 'Hiring' | 'Tufts'>('All');
  const [q, setQ] = useState('');
  const tab = me.persona === 'alumni';
  const people = world.alumni
    .filter((p) => p.name !== me.name && (p.mentoring || p.hiring))
    .filter(
      (p) =>
        f === 'All' ||
        (f === 'Mentoring'
          ? p.mentoring
          : f === 'Hiring'
            ? p.hiring
            : p.school.startsWith('Tufts')),
    )
    .filter(
      (p) =>
        !q.trim() || (p.name + p.work + p.school).toLowerCase().includes(q.trim().toLowerCase()),
    );
  return (
    <Screen tabs={tab} style={{ padding: tab ? '52px 20px 112px' : undefined, gap: 12 }}>
      {!tab && <BackBtn label="Me" />}
      <Title>Alumni who help</Title>
      <label htmlFor="as" className="sr-only">
        Search alumni
      </label>
      <input
        id="as"
        type="search"
        className="input"
        placeholder="Employer, college or name"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="row g8 wrap">
        {(['All', 'Mentoring', 'Hiring', 'Tufts'] as const).map((c) => (
          <InkChip key={c} sm on={f === c} onClick={() => setF(c)}>
            {c}
          </InkChip>
        ))}
      </div>
      {people.map((p, i) => (
        <button
          key={p.id}
          className="card-row"
          onClick={() => nav.go('alumniProfile', { id: p.id })}
        >
          <Circle name={p.name} color={ACOL[i % ACOL.length]} size={44} />
          <span className="stack grow" style={{ gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{p.name}</span>
            <span className="tiny" style={{ color: 'var(--text-2)' }}>
              {p.work}
            </span>
            <span className="tiny">
              {p.school} · {p.sport}
            </span>
          </span>
          <span className="stack g4" style={{ alignItems: 'flex-end' }}>
            {p.mentoring && <span className="pill pill-navy">MENTORING</span>}
            {p.hiring && <span className="pill pill-red">HIRING</span>}
          </span>
        </button>
      ))}
      {!people.length && <Empty title="No one yet">Try a different filter or search.</Empty>}
    </Screen>
  );
}

export function AlumniProfile() {
  const { nav, toast } = useApp();
  const { world } = useWorld();
  const p = world.alumni.find((x) => x.id === nav.params.id);
  if (!p)
    return (
      <Screen>
        <BackBtn label="Alumni" />
        <Empty title="Profile not found" />
      </Screen>
    );
  const first = p.name.split(' ')[0] ?? p.name;
  const handle = p.name.toLowerCase().replace(/[^a-z]/g, '');
  return (
    <div className="screen" style={{ minHeight: '100%' }}>
      <div
        className="stack g12"
        style={{ background: 'var(--navy)', color: '#fff', padding: '52px 20px 22px' }}
      >
        <BackBtn label="Alumni" light />
        <div className="row g14">
          <span
            className="avatar"
            style={{
              width: 72,
              height: 72,
              background: '#fff',
              color: 'var(--navy)',
              fontFamily: 'var(--display)',
              fontWeight: 800,
              fontSize: 30,
            }}
          >
            {initials(p.name)}
          </span>
          <div className="stack" style={{ gap: 3 }}>
            <h1 className="display d-36" style={{ color: '#fff' }}>
              {p.name}
            </h1>
            <div style={{ fontSize: 14, color: 'var(--on-navy)' }}>
              {p.work} · {p.city.split(',')[0]}
            </div>
          </div>
        </div>
        <div className="row g8">
          {p.mentoring && (
            <span className="pill" style={{ background: '#fff', color: 'var(--navy-pressed)' }}>
              MENTORING
            </span>
          )}
          {p.hiring && (
            <span className="pill" style={{ background: 'var(--red)', color: '#fff' }}>
              HIRING
            </span>
          )}
        </div>
      </div>
      <div className="stack g14" style={{ padding: '18px 20px 28px' }}>
        <div className="list">
          <div className="kv">
            <span>College</span>
            <span>{p.school}</span>
          </div>
          <div className="kv">
            <span>Played</span>
            <span>{p.sport}</span>
          </div>
        </div>
        <div className="sec">Reach {first}</div>
        <div className="list">
          <button
            className="lrow"
            onClick={() => toast('Opens your email to ' + first)}
            style={{ color: 'var(--navy)', fontSize: 15 }}
          >
            <Icon name="mail" />
            {handle}@email.com
          </button>
          <button
            className="lrow"
            onClick={() => toast('Opens LinkedIn')}
            style={{ color: 'var(--navy)', fontSize: 15 }}
          >
            <Icon name="link" />
            linkedin.com/in/{handle}
          </button>
        </div>
        <button
          className="lrow panel"
          onClick={() => toast(first + ' hasn’t published a card yet')}
        >
          <span className="grow">View {first}’s Baseball Card</span>
          <Icon name="next" />
        </button>
        <div className="tiny">
          Shown because {first} turned on{' '}
          {[p.mentoring && 'mentoring', p.hiring && 'hiring'].filter(Boolean).join(' and ')}. Alumni
          never see athlete lists.
        </div>
      </div>
    </div>
  );
}
