// Sign up and join: welcome -> account (age + role gating) -> details -> house rules -> find team -> request / QR -> signed.
import { useState } from 'react';
import { useWorld } from '../../shared/store';
import { Field, Icon, Logo } from '../../shared/ui';
import { BackBtn, Err, Head, InkChip, Notice, Options, PhoneSheet, Screen, Title } from '../parts';
import {
  PERSONAS,
  ROLE_OPTIONS,
  addRequest,
  bumpMembers,
  dropRequest,
  setRequest,
  uid,
  type Role,
  type Screen as ScreenId,
} from '../model';
import { useApp } from '../state';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const YEARS = Array.from({ length: 57 }, (_, i) => 2016 - i);
const PERSONAL = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'aol.com',
  'proton.me',
];
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
const roleName = (r: Role) =>
  (ROLE_OPTIONS.find((o) => o.id === r)?.name ?? '').replace(', 13–17', '');
const band = (year: number) => {
  const age = 2026 - year;
  return age < 13 ? 'kid' : age < 18 ? 'teen' : 'adult';
};
export const effectiveRole = (role: Role, year: number): Role =>
  band(year) === 'teen' ? 'teen' : role === 'teen' ? 'athlete' : role;
const joins = (r: Role) => r === 'athlete' || r === 'parent' || r === 'teen';

/* ---------------- Welcome ---------------- */
export function Welcome() {
  const { nav, become, setDraft } = useApp();
  const [signIn, setSignIn] = useState(false);
  return (
    <Screen style={{ padding: '64px 24px 32px', gap: 18 }}>
      <Logo size={92} />
      <h1 className="display" style={{ fontSize: 64, lineHeight: 0.88 }}>
        All in.
        <br />
        <span style={{ color: 'var(--red)' }}>All together.</span>
      </h1>
      <p className="body" style={{ fontSize: 17, maxWidth: 300 }}>
        Your team, your families and your Baseball Card, in one place.
      </p>
      <div
        aria-hidden="true"
        style={{
          flexGrow: 1,
          minHeight: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 170,
            height: 226,
            borderRadius: 16,
            background: 'var(--red)',
            transform: 'rotate(8deg) translateX(46px)',
          }}
        />
        <div
          className="deal"
          style={{
            position: 'relative',
            width: 170,
            height: 226,
            borderRadius: 16,
            background: 'var(--navy)',
            color: '#fff',
            transform: 'rotate(-6deg)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: 16,
            boxShadow: '0 20px 40px rgba(17,20,24,.25)',
          }}
        >
          <div
            style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 56, lineHeight: 1 }}
          >
            07
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.1em' }}>ROOKIE · 2026</div>
        </div>
      </div>
      <div className="stack g12">
        <button
          className="btn btn-primary btn-lg btn-full"
          onClick={() => {
            setDraft((d) => ({ ...d, via: 'qr' }));
            nav.go('scan', { pre: '1' });
          }}
        >
          <Icon name="qr" size={22} />
          Scan a team QR code
        </button>
        <button
          className="btn btn-outline btn-lg btn-full"
          onClick={() => {
            setDraft((d) => ({ ...d, via: 'request' }));
            nav.go('account');
          }}
        >
          Create an account
        </button>
        <button className="btn btn-ghost btn-full" onClick={() => setSignIn(true)}>
          I already have an account
        </button>
      </div>
      <PhoneSheet open={signIn} onClose={() => setSignIn(false)} label="Sign in">
        <h2 className="display d-28">Sign in as</h2>
        <p className="small" style={{ margin: 0 }}>
          Demo accounts. Pick one to see the app from their side.
        </p>
        <div className="list">
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              className="lrow"
              onClick={() => {
                setSignIn(false);
                become(p.id);
              }}
            >
              <span className="grow">{p.name}</span>
              <span className="v">{p.label}</span>
              <Icon name="next" size={18} />
            </button>
          ))}
        </div>
      </PhoneSheet>
    </Screen>
  );
}

/* ---------------- Account ---------------- */
export function Account() {
  const { nav, draft, setDraft } = useApp();
  const [month, setMonth] = useState('March');
  const [day, setDay] = useState('14');
  const [pw, setPw] = useState('');
  const [tried, setTried] = useState(false);
  const b = band(draft.year);
  const role = effectiveRole(draft.role, draft.year);
  const work = role === 'recruiter';
  const domain = draft.email.split('@')[1]?.toLowerCase() ?? '';
  const errs = {
    name: !draft.name.trim() ? 'Enter your full name.' : '',
    email:
      b === 'kid'
        ? ''
        : !emailOk(draft.email)
          ? 'Enter a valid email address.'
          : work && PERSONAL.includes(domain)
            ? 'Personal email addresses can’t be used. Use your work email.'
            : '',
    pw: b === 'kid' ? '' : pw.length < 8 ? 'Use at least 8 characters.' : '',
  };
  const ok = !errs.name && !errs.email && !errs.pw;
  const next = () => {
    if (b === 'kid') {
      nav.go('under13');
      return;
    }
    if (!ok) {
      setTried(true);
      return;
    }
    setDraft((d) => ({ ...d, role }));
    nav.go('details');
  };
  const opts = ROLE_OPTIONS.map((o) => ({
    ...o,
    disabled: b === 'kid' || (b === 'teen' ? o.id !== 'teen' : o.id === 'teen'),
  }));
  return (
    <Screen style={{ gap: 12 }}>
      <BackBtn />
      <Head eyebrow="STEP 1 OF 3 · CREATE ACCOUNT" title="Who are you?" />
      <fieldset className="field" style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="label" style={{ padding: 0, marginBottom: 5 }}>
          Date of birth
        </legend>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr .8fr 1fr', gap: 8 }}>
          <select
            className="select"
            aria-label="Month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {MONTHS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <select
            className="select"
            aria-label="Day"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          >
            {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <select
            className="select"
            aria-label="Year"
            value={draft.year}
            onChange={(e) => setDraft((d) => ({ ...d, year: Number(e.target.value) }))}
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="tiny">Used only to check your age. Never shown on your profile.</div>
      </fieldset>
      <Options options={opts} value={role} onChange={(r) => setDraft((d) => ({ ...d, role: r }))} />
      {b !== 'adult' && (
        <div role="status" className="tint">
          {b === 'kid'
            ? 'Under 13s can’t have their own account. Continue to see what to do.'
            : 'You’re 13–17, so you’ll join as a Teammate with a few extra protections.'}
        </div>
      )}
      <Field label="Full name" htmlFor="nm" error={tried ? errs.name : ''}>
        <input
          id="nm"
          className={'input' + (tried && errs.name ? ' err' : '')}
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          autoComplete="name"
        />
      </Field>
      {b !== 'kid' && (
        <>
          <Field label={work ? 'Work email' : 'Email'} htmlFor="em" error={tried ? errs.email : ''}>
            <input
              id="em"
              type="email"
              className={'input' + (tried && errs.email ? ' err' : '')}
              value={draft.email}
              placeholder={
                work
                  ? 'name@northbeam.com'
                  : role === 'athlete'
                    ? 'name@tufts.edu'
                    : 'name@email.com'
              }
              onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
              autoComplete="email"
            />
          </Field>
          <Field
            label="Password"
            htmlFor="pw"
            error={tried ? errs.pw : ''}
            hint="At least 8 characters."
          >
            <input
              id="pw"
              type="password"
              className={'input' + (tried && errs.pw ? ' err' : '')}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </>
      )}
      <button className="btn btn-primary btn-lg btn-full mt-auto" onClick={next}>
        {b === 'kid' ? 'Continue' : 'Continue as ' + roleName(role).toLowerCase()}
      </button>
      <button className="btn btn-ghost btn-full" onClick={() => nav.go('under13')}>
        Signing up a child under 13?
      </button>
    </Screen>
  );
}

/* ---------------- Under 13 ---------------- */
export function Under13() {
  const { nav, setDraft, become } = useApp();
  return (
    <Screen style={{ padding: '52px 24px 28px', gap: 20 }}>
      <BackBtn />
      <div className="stack g20 grow" style={{ justifyContent: 'center' }}>
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 24,
            background: 'var(--navy-tint)',
            color: 'var(--navy)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="shield" size={40} />
        </div>
        <Title size={44}>A grown-up sets this one up</Title>
        <p className="body" style={{ fontSize: 17, color: '#2A2E35' }}>
          Teammates under 13 don’t have their own account. A parent or guardian joins the team and
          runs your profile: your first name, photo, age and the things you love.
        </p>
        <p className="body" style={{ fontSize: 15 }}>
          Your profile is only ever seen by your team and your family.
        </p>
      </div>
      <div className="stack g10">
        <button
          className="btn btn-primary btn-lg btn-full"
          onClick={() => {
            setDraft((d) => ({
              ...d,
              role: 'parent',
              year: 1984,
              name: d.name === 'Maya Okafor' ? '' : d.name,
            }));
            nav.reset('welcome');
            nav.go('account');
          }}
        >
          I’m the parent, set it up
        </button>
        <button className="btn btn-ghost btn-full" onClick={() => become('new')}>
          Back to start
        </button>
      </div>
    </Screen>
  );
}

/* ---------------- Details (step 2) ---------------- */
export function Details() {
  const { nav, draft, setDraft, toast } = useApp();
  const { world } = useWorld();
  const role = draft.role;
  const [tried, setTried] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [f, setF] = useState({
    college: 'Tufts University',
    sport: 'ws',
    year: '2028',
    position: 'Midfielder',
    num: '7',
    rel: 'Parent',
    interests: '',
    about: '',
    parentEmail: '',
    coachRole: 'Head coach',
    phone: '',
    alumKind: 'Former athlete',
    alumCollege: 'Boston College',
    alumYear: '2019',
    work: 'Fidelity',
    workRole: 'Analyst',
    mentoring: true,
    hiring: false,
    linkedin: 'linkedin.com/in/',
    title: 'Campus recruiter',
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const domain = draft.email.split('@')[1]?.toLowerCase() ?? '';
  const company = world.companies.find((c) => c.domains.includes(domain));
  const age = Number(draft.childAge);
  const errs: Record<string, string> = {
    college: role === 'athlete' && !f.college.trim() ? 'Enter your college.' : '',
    child:
      (role === 'parent' &&
        (!draft.child.trim()
          ? 'Enter your child’s first name.'
          : /\s/.test(draft.child.trim())
            ? 'First name only, please.'
            : '')) ||
      '',
    age:
      role === 'parent'
        ? !Number.isInteger(age) || age < 3
          ? 'Enter an age from 3 to 12.'
          : age > 12
            ? 'Kids 13 and up join with their own Teammate account.'
            : ''
        : '',
    parentEmail:
      role === 'teen' && !emailOk(f.parentEmail) ? 'Enter your parent or guardian’s email.' : '',
    alum:
      role === 'alumni' && (!f.alumCollege.trim() || !f.work.trim())
        ? 'Fill in your college and where you work.'
        : '',
    company:
      role === 'recruiter' && (!company || company.status !== 'active')
        ? company?.status === 'suspended'
          ? 'This company’s access is paused. Contact Team IMPACT.'
          : `${domain || 'This domain'} isn’t a Team IMPACT partner yet. Ask your partnerships contact to add it.`
        : '',
    title: role === 'recruiter' && !f.title.trim() ? 'Enter your job title.' : '',
  };
  const ok = Object.values(errs).every((e) => !e);
  const go = () => {
    if (!ok) {
      setTried(true);
      return;
    }
    setDraft((d) => ({
      ...d,
      teamId: role === 'athlete' ? f.sport : d.teamId,
      agree: false,
      parentOk: false,
    }));
    nav.go('terms');
  };
  const E = (k: string) => (tried ? (errs[k] ?? '') : '');
  const titles: Record<Role, string> = {
    athlete: 'Your team basics',
    parent: 'You and your kid',
    teen: 'Tell your team about you',
    coach: 'You’re invited to coach',
    alumni: 'Welcome back',
    recruiter: 'Verify your company',
  };
  const PhotoRow = ({ text }: { text: string }) => (
    <button
      type="button"
      onClick={() => {
        setPhoto(true);
        toast('Photo added');
      }}
      className="card-row"
      style={{ border: '1.5px dashed var(--field-line)', cursor: 'pointer' }}
    >
      <span
        className="avatar"
        style={{
          width: 52,
          height: 52,
          background: photo ? 'var(--navy)' : 'var(--line-soft)',
          color: photo ? '#fff' : 'var(--muted)',
        }}
      >
        <Icon name={photo ? 'check' : 'camera'} size={22} />
      </span>
      <span className="stack g4 grow">
        <span style={{ fontSize: 15, fontWeight: 600 }}>
          {photo ? 'Photo added' : 'Add a profile photo'}
        </span>
        <span className="tiny">{text}</span>
      </span>
    </button>
  );
  return (
    <Screen style={{ gap: 13 }}>
      <BackBtn />
      <Head
        eyebrow={'STEP 2 OF 3 · ' + roleName(role).toUpperCase()}
        title={titles[role]}
        sub={
          role === 'athlete'
            ? 'That’s all you need to join. Your Baseball Card comes later.'
            : undefined
        }
      />
      {role === 'athlete' && (
        <>
          <Field label="College" htmlFor="col" error={E('college')}>
            <input
              id="col"
              className="input"
              value={f.college}
              onChange={(e) => set('college', e.target.value)}
            />
          </Field>
          <div className="grid2">
            <Field label="Sport" htmlFor="sp">
              <select
                id="sp"
                className="select"
                value={f.sport}
                onChange={(e) => set('sport', e.target.value)}
              >
                {world.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Class of" htmlFor="yr">
              <select
                id="yr"
                className="select"
                value={f.year}
                onChange={(e) => set('year', e.target.value)}
              >
                {['2026', '2027', '2028', '2029', '2030'].map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid2">
            <Field label="Position" optional htmlFor="pos">
              <input
                id="pos"
                className="input"
                value={f.position}
                onChange={(e) => set('position', e.target.value)}
              />
            </Field>
            <Field label="Number" optional htmlFor="num">
              <input
                id="num"
                className="input"
                inputMode="numeric"
                value={f.num}
                onChange={(e) => set('num', e.target.value.replace(/\D/g, '').slice(0, 2))}
              />
            </Field>
          </div>
          <PhotoRow text="Optional. Used on your card too." />
        </>
      )}
      {role === 'parent' && (
        <>
          <fieldset className="field" style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="label" style={{ padding: 0, marginBottom: 5 }}>
              I’m their
            </legend>
            <Options
              center
              options={[
                { id: 'Parent', name: 'Parent' },
                { id: 'Guardian', name: 'Guardian' },
              ]}
              value={f.rel}
              onChange={(v) => set('rel', v)}
            />
          </fieldset>
          <div className="stack g12" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <div className="sec">Your child’s profile</div>
            <div className="row g10" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <Field label="First name only" htmlFor="cfn" error={E('child')}>
                  <input
                    id="cfn"
                    className="input"
                    value={draft.child}
                    onChange={(e) => setDraft((d) => ({ ...d, child: e.target.value }))}
                  />
                </Field>
              </div>
              <div style={{ width: 84 }}>
                <Field label="Age" htmlFor="cag">
                  <input
                    id="cag"
                    className="input"
                    inputMode="numeric"
                    value={draft.childAge}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        childAge: e.target.value.replace(/\D/g, '').slice(0, 2),
                      }))
                    }
                  />
                </Field>
              </div>
            </div>
            <Err>{E('age')}</Err>
            <Field label="Interests" optional htmlFor="cint">
              <textarea
                id="cint"
                className="textarea"
                style={{ minHeight: 72 }}
                placeholder="Goalkeeping, dinosaurs, picking the playlist"
                value={f.interests}
                onChange={(e) => set('interests', e.target.value)}
              />
            </Field>
          </div>
          <Notice icon="lock">
            {(draft.child.trim() || 'Your child') +
              '’s profile is run by you. No login, seen only by your team and family. We never ask for health or medical details.'}
          </Notice>
        </>
      )}
      {role === 'teen' && (
        <>
          <Field label="Name your team sees" htmlFor="dn" hint="First name is fine.">
            <input
              id="dn"
              className="input"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </Field>
          <Field label="About me" optional htmlFor="ti">
            <textarea
              id="ti"
              className="textarea"
              style={{ minHeight: 76 }}
              placeholder="Favorite player, music, what you’re into"
              value={f.about}
              onChange={(e) => set('about', e.target.value)}
            />
          </Field>
          <Field
            label="Parent or guardian’s email"
            htmlFor="pe"
            error={E('parentEmail')}
            hint="We’ll email them so they know you joined."
          >
            <input
              id="pe"
              type="email"
              className={'input' + (E('parentEmail') ? ' err' : '')}
              placeholder="parent@email.com"
              value={f.parentEmail}
              onChange={(e) => set('parentEmail', e.target.value)}
            />
          </Field>
          <div className="panel stack g10" style={{ padding: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>How your account works</div>
            {[
              'Only your team and family can see your profile',
              'Your posts go to your team; you can comment anywhere',
            ].map((t) => (
              <div key={t} className="row g10 small" style={{ alignItems: 'flex-start' }}>
                <Icon
                  name="check"
                  size={16}
                  style={{ color: '#0F7B5F', flexShrink: 0, marginTop: 2 }}
                />
                {t}
              </div>
            ))}
            <div className="row g10 small" style={{ alignItems: 'flex-start' }}>
              <Icon name="lock" size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              Athletes’ phone numbers and emails stay hidden
            </div>
          </div>
        </>
      )}
      {role === 'coach' && (
        <>
          <div
            className="row g14"
            style={{ padding: 14, borderRadius: 16, background: 'var(--navy)', color: '#fff' }}
          >
            <span
              className="tile"
              style={{
                width: 48,
                height: 48,
                background: '#fff',
                color: 'var(--navy)',
                fontSize: 20,
              }}
            >
              WS
            </span>
            <span className="stack grow" style={{ gap: 2 }}>
              <span style={{ fontSize: 17, fontWeight: 600 }}>Women’s Soccer · Tufts</span>
              <span style={{ fontSize: 13, color: 'var(--on-navy)' }}>
                Invited by Team IMPACT staff
              </span>
            </span>
            <Icon name="check" />
          </div>
          <fieldset className="field" style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="label" style={{ padding: 0, marginBottom: 5 }}>
              Your role
            </legend>
            <Options
              center
              options={[
                { id: 'Head coach', name: 'Head coach' },
                { id: 'Assistant coach', name: 'Assistant coach' },
              ]}
              value={f.coachRole}
              onChange={(v) => set('coachRole', v)}
            />
          </fieldset>
          <Field label="Phone" optional htmlFor="cph" hint="Shown to your team.">
            <input
              id="cph"
              type="tel"
              className="input"
              placeholder="(617) 555-0142"
              value={f.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </Field>
          <PhotoRow text="Optional." />
        </>
      )}
      {role === 'alumni' && (
        <>
          <fieldset className="field" style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="label" style={{ padding: 0, marginBottom: 5 }}>
              I’m a
            </legend>
            <Options
              center
              options={[
                { id: 'Former athlete', name: 'Former athlete' },
                { id: 'Former Team IMPACT kid', name: 'Former Team IMPACT kid' },
              ]}
              value={f.alumKind}
              onChange={(v) => set('alumKind', v)}
            />
          </fieldset>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 10 }}>
            <Field label="College attended" htmlFor="ac">
              <input
                id="ac"
                className="input"
                value={f.alumCollege}
                onChange={(e) => set('alumCollege', e.target.value)}
              />
            </Field>
            <Field label="Class of" htmlFor="ay">
              <input
                id="ay"
                className="input"
                inputMode="numeric"
                value={f.alumYear}
                onChange={(e) => set('alumYear', e.target.value)}
              />
            </Field>
          </div>
          <div className="grid2">
            <Field label="Where you work" htmlFor="aw">
              <input
                id="aw"
                className="input"
                value={f.work}
                onChange={(e) => set('work', e.target.value)}
              />
            </Field>
            <Field label="Your role" htmlFor="ar">
              <input
                id="ar"
                className="input"
                value={f.workRole}
                onChange={(e) => set('workRole', e.target.value)}
              />
            </Field>
          </div>
          <Err>{E('alum')}</Err>
          <div className="label">Open to helping athletes?</div>
          {(
            [
              ['mentoring', 'Mentoring', 'Athletes can find you and see your contacts'],
              ['hiring', 'Hiring', 'Shown as recruiting on your profile'],
            ] as const
          ).map(([k, t, s]) => (
            <label
              key={k}
              className="check panel"
              style={{
                padding: '10px 14px',
                alignItems: 'center',
                borderColor: f[k] ? 'var(--navy)' : undefined,
              }}
            >
              <input type="checkbox" checked={f[k]} onChange={(e) => set(k, e.target.checked)} />
              <span className="stack">
                <span style={{ fontWeight: 600 }}>{t}</span>
                <span className="tiny">{s}</span>
              </span>
            </label>
          ))}
          <Field label="LinkedIn" optional htmlFor="ali">
            <input
              id="ali"
              className="input"
              value={f.linkedin}
              onChange={(e) => set('linkedin', e.target.value)}
            />
          </Field>
        </>
      )}
      {role === 'recruiter' && (
        <>
          <Field label="Work email" htmlFor="we">
            <input
              id="we"
              className="input"
              value={draft.email}
              readOnly
              style={{
                borderColor: company?.status === 'active' ? '#0F7B5F' : 'var(--danger)',
                borderWidth: 2,
              }}
            />
          </Field>
          {company && company.status === 'active' ? (
            <div
              className="row g10"
              style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--ok-bg)' }}
            >
              <span
                className="tile"
                style={{
                  width: 34,
                  height: 34,
                  background: 'var(--ink)',
                  fontSize: 12,
                  fontFamily: 'var(--ui)',
                  fontWeight: 600,
                }}
              >
                {company.name
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)}
              </span>
              <span className="stack">
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ok-fg)' }}>
                  {company.name}
                </span>
                <span style={{ fontSize: 13, color: '#0B5A45' }}>
                  A Team IMPACT partner company
                </span>
              </span>
            </div>
          ) : (
            <Err>{errs.company}</Err>
          )}
          <Field label="Job title" htmlFor="jt" error={E('title')}>
            <input
              id="jt"
              className="input"
              value={f.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </Field>
          <div className="tiny" style={{ color: 'var(--text-2)' }}>
            We’ll email a link to {draft.email || 'your work email'}. You can review athletes once
            you click it.
          </div>
          {!company && (
            <button className="btn btn-ghost" onClick={() => nav.back()}>
              Change email
            </button>
          )}
        </>
      )}
      <button className="btn btn-primary btn-lg btn-full mt-auto" onClick={go}>
        Continue
      </button>
    </Screen>
  );
}

/* ---------------- House rules (step 3) ---------------- */
export function Terms() {
  const { nav, draft, setDraft } = useApp();
  const { update } = useWorld();
  const [tried, setTried] = useState(false);
  const role = draft.role,
    child = draft.child.trim() || 'your child';
  const sets: Record<Role, string[]> = {
    athlete: [
      'Everyone here is vouched for. Coaches approve who joins each team.',
      'You choose who sees your contact details. Recruiters only see athletes who publish a card and turn on open to recruiting.',
      'No health or diagnosis details, about you or anyone else.',
      'Be kind. Every post is checked before it appears, and you can report or block anyone.',
    ],
    parent: [
      'Everyone here is vouched for. Coaches approve who joins each team.',
      child + '’s profile is seen only by the team and family, and has no login of its own.',
      'No health or diagnosis details, about you, ' + child + ' or anyone else.',
      'Be kind. Every post is checked before it appears, and you can report or block anyone.',
    ],
    teen: [
      'Your profile is seen only by your team and your family.',
      'You can read and comment on the whole feed. Your posts go to your team.',
      'Be kind. Every post is checked before it appears, and you can report or block anyone.',
    ],
    coach: [
      'You approve who joins your team. Only accept people you know are on it or are Team IMPACT family.',
      'You can remove members and turn off QR codes at any time.',
      'No health or diagnosis details, about anyone.',
      'Be kind. Every post is checked before it appears.',
    ],
    alumni: [
      'You can post to the community and browse other alumni.',
      'Team rosters, kids’ profiles and athletes’ contacts stay private from alumni.',
      'Be kind. Every post is checked before it appears, and you can report or block anyone.',
    ],
    recruiter: [
      'You only see athletes who publish a card and turn on open to recruiting.',
      'Every search is logged. Use what you see only for recruiting at your company.',
      'Contact athletes only through the details they chose to share.',
    ],
  };
  const ok = draft.agree && (role !== 'teen' || draft.parentOk);
  const next = () => {
    if (!ok) {
      setTried(true);
      return;
    }
    if (joins(role)) {
      if (draft.via === 'qr') {
        update(bumpMembers(draft.teamId, 1));
        nav.go('signed');
      } else nav.go('find');
    } else nav.go(role === 'recruiter' ? 'verify' : 'signed');
  };
  return (
    <Screen style={{ gap: 16 }}>
      <BackBtn />
      <Head eyebrow={'STEP 3 OF 3 · ' + roleName(role).toUpperCase()} title="The house rules" />
      <ol className="panel stack g14" style={{ padding: 18, margin: 0, listStyle: 'none' }}>
        {sets[role].map((t, i) => (
          <li key={i} className="row g12" style={{ alignItems: 'flex-start' }}>
            <span className="rule-n" aria-hidden="true">
              {i + 1}
            </span>
            <span style={{ fontSize: 15, lineHeight: 1.45 }}>{t}</span>
          </li>
        ))}
      </ol>
      <div className="stack g10">
        <label className="check">
          <input
            type="checkbox"
            checked={draft.agree}
            onChange={(e) => setDraft((d) => ({ ...d, agree: e.target.checked }))}
          />
          I agree to the Terms and Privacy Policy.
        </label>
        {role === 'teen' && (
          <label className="check">
            <input
              type="checkbox"
              checked={draft.parentOk}
              onChange={(e) => setDraft((d) => ({ ...d, parentOk: e.target.checked }))}
            />
            A parent or guardian knows I’m joining and agreed.
          </label>
        )}
      </div>
      {tried && !ok && (
        <Err>{role === 'teen' ? 'Tick both boxes to continue.' : 'Tick the box to continue.'}</Err>
      )}
      <button className="btn btn-primary btn-lg btn-full mt-auto" onClick={next}>
        Agree and continue
      </button>
    </Screen>
  );
}

/* ---------------- Find your team ---------------- */
const SPORTS = ['Soccer', 'Lacrosse', 'Baseball', 'Basketball', 'Swimming', 'Volleyball'];
export function FindTeam() {
  const { nav, draft, setDraft } = useApp();
  const { world } = useWorld();
  const [college, setCollege] = useState('Tufts University');
  const [sport, setSport] = useState('Soccer');
  const matches = world.teams.filter(
    (t) =>
      t.sport === sport &&
      t.college.toLowerCase().includes(college.trim().toLowerCase().split(' ')[0] ?? ''),
  );
  const reg = matches.filter((t) => t.registered),
    missing = matches.filter((t) => !t.registered);
  const parent = draft.role === 'parent';
  const child = draft.child.trim() || 'your child';
  return (
    <Screen style={{ gap: 16 }}>
      <div className="stack g6">
        <div className="eyebrow navy">
          {parent ? 'ADD ' + child.toUpperCase() + ' TO A TEAM' : 'JOIN A TEAM'}
        </div>
        <Title size={44}>{parent ? 'Find ' + child + '’s team' : 'Find your team'}</Title>
      </div>
      <Field label="College" htmlFor="fcol">
        <input
          id="fcol"
          className="input"
          style={{ borderColor: 'var(--ink)', borderWidth: 2 }}
          value={college}
          onChange={(e) => setCollege(e.target.value)}
        />
      </Field>
      <div className="stack g8">
        <div className="label">Sport</div>
        <div className="row wrap g8">
          {SPORTS.map((s) => (
            <InkChip key={s} on={s === sport} onClick={() => setSport(s)}>
              {s}
            </InkChip>
          ))}
        </div>
      </div>
      <div className="stack g6">
        <div className="label">Registered teams</div>
        <div className="stack" style={{ borderTop: '1px solid var(--line)' }}>
          {reg.map((t) => (
            <button
              key={t.id}
              className="row g14"
              onClick={() => {
                setDraft((d) => ({ ...d, teamId: t.id }));
                nav.go('request');
              }}
              style={{
                padding: '14px 0',
                border: 0,
                borderBottom: '1px solid var(--line)',
                background: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: 'var(--ink)',
                font: 'inherit',
              }}
            >
              <span
                className="tile"
                style={{ width: 44, height: 44, background: t.color, fontSize: 18 }}
              >
                {t.abbr}
              </span>
              <span className="stack grow" style={{ gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{t.name}</span>
                <span className="small" style={{ color: 'var(--muted)' }}>
                  {t.college} · Division {t.division}
                </span>
              </span>
              <Icon name="next" />
            </button>
          ))}
          {!reg.length && (
            <div className="small" style={{ padding: '14px 0' }}>
              No registered {sport.toLowerCase()} teams at this college yet.
            </div>
          )}
        </div>
      </div>
      {(missing.length > 0 || !matches.length) && (
        <div
          className="row g12"
          style={{
            padding: 14,
            borderRadius: 14,
            background: '#fff',
            border: '1.5px dashed var(--field-line)',
            alignItems: 'flex-start',
          }}
        >
          <Icon name="info" style={{ flexShrink: 0 }} />
          <div className="stack g4">
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {missing[0]?.name ?? sport} isn’t on Team IMPACT yet
            </div>
            <div className="small">
              Ask the coach to contact Team IMPACT. You can request to join once the team is set up.
            </div>
          </div>
        </div>
      )}
      <button
        className="btn btn-lg btn-full mt-auto"
        style={{ border: '1.5px solid var(--ink)', background: 'transparent', color: 'var(--ink)' }}
        onClick={() => nav.go('scan')}
      >
        Have a QR code from the coach? Scan it
      </button>
    </Screen>
  );
}

/* ---------------- Request to join ---------------- */
export function RequestJoin() {
  const { nav, draft, setDraft } = useApp();
  const { world, update } = useWorld();
  const team = world.teams.find((t) => t.id === draft.teamId) ?? world.teams[0]!;
  const [addChild, setAddChild] = useState(true);
  const [tried, setTried] = useState(false);
  const role = draft.role,
    child = draft.child.trim() || 'Leo';
  const shares: [string, string][] =
    role === 'parent'
      ? [
          ['You', draft.name],
          ['Relationship', 'Parent of ' + child],
          [child, 'Age ' + draft.childAge + ', first name only'],
        ]
      : role === 'teen'
        ? [
            ['Name', draft.name],
            ['Account', 'Teammate, 13–17'],
            ['Parent email', 'Confirmed by email'],
          ]
        : [
            ['Joining as', 'Athlete'],
            ['Name', draft.name],
            ['College', team.college],
            ['Class of', '2028'],
          ];
  const send = () => {
    if (role === 'parent' && !addChild) {
      setTried(true);
      return;
    }
    const id = uid('r');
    const detail =
      role === 'parent'
        ? `Parent of ${child}, age ${draft.childAge}`
        : role === 'teen'
          ? 'Teammate, 13–17 · parent confirmed'
          : 'Class of 2028 · ' + team.college.replace(' University', '');
    update(
      addRequest({
        id,
        teamId: team.id,
        name: draft.name,
        role: role === 'parent' ? 'parent' : role === 'teen' ? 'teen' : 'athlete',
        detail,
        status: 'pending',
      }),
    );
    setDraft((d) => ({ ...d, requestId: id }));
    nav.go('pending');
  };
  return (
    <Screen style={{ gap: 16 }}>
      <BackBtn label="Teams" />
      <div
        className="row g14"
        style={{ padding: 16, borderRadius: 18, background: team.color, color: '#fff' }}
      >
        <span
          className="tile"
          style={{ width: 52, height: 52, background: '#fff', color: 'var(--ink)', fontSize: 22 }}
        >
          {team.abbr}
        </span>
        <span className="stack" style={{ gap: 2 }}>
          <span
            style={{
              fontFamily: 'var(--display)',
              fontWeight: 800,
              fontSize: 26,
              textTransform: 'uppercase',
              lineHeight: 1,
            }}
          >
            {team.name}
          </span>
          <span style={{ fontSize: 14 }}>
            {team.college.replace(' University', '')} · {team.coach}
          </span>
        </span>
      </div>
      <Title size={36}>{role === 'parent' ? 'Ask to join with ' + child : 'Ask to join'}</Title>
      <div className="sec">The coach will see</div>
      <div className="list">
        {shares.map(([k, v]) => (
          <div key={k} className="kv">
            <span>{k}</span>
            <span>{v}</span>
          </div>
        ))}
      </div>
      {role === 'parent' && (
        <label className="check tint" style={{ alignItems: 'center', fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={addChild}
            onChange={(e) => setAddChild(e.target.checked)}
          />
          Add {child} to this team too
        </label>
      )}
      {tried && role === 'parent' && !addChild && (
        <Err>{child} needs to be on the team for you to join as their parent.</Err>
      )}
      {role === 'athlete' && (
        <p className="small" style={{ margin: 0 }}>
          That’s all the coach needs. No resume yet; you’ll build your Baseball Card after you’re
          signed.
        </p>
      )}
      {role === 'parent' && (
        <Notice icon="lock">
          {child}’s profile is only ever seen by the team and family. Nothing about the team shows
          until the coach approves you.
        </Notice>
      )}
      <button className="btn btn-primary btn-lg btn-full mt-auto" onClick={send}>
        Send request
      </button>
    </Screen>
  );
}

/* ---------------- Pending ---------------- */
export function Pending() {
  const { nav, draft } = useApp();
  const { world, update } = useWorld();
  const team = world.teams.find((t) => t.id === draft.teamId) ?? world.teams[0]!;
  const req = world.joinRequests.find((r) => r.id === draft.requestId);
  const approved = req?.status === 'approved';
  const child = draft.child.trim() || 'Leo';
  return (
    <Screen style={{ padding: '56px 24px 28px', gap: 20 }}>
      <div className="eyebrow navy">REQUEST SENT</div>
      <div
        className="stack g20 grow"
        style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: 'var(--navy-tint)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              background: approved ? '#0F7B5F' : 'var(--red)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={approved ? 'check' : 'mail'} size={38} />
          </span>
        </div>
        <Title size={44}>
          {approved ? (
            'You’re approved'
          ) : (
            <>
              Waiting on
              <br />
              the coach
            </>
          )}
        </Title>
        <p className="body" style={{ maxWidth: 300 }}>
          {approved
            ? 'The coach said yes. Tap below to see your stamp.'
            : `Your request to join ${team.name} is with ${team.coach}, usually within a day. ${draft.role === 'parent' ? `We’ll let you know when you and ${child} are in.` : 'We’ll let you know the moment you’re signed.'}`}
        </p>
        <div className="list" style={{ width: '100%', textAlign: 'left' }}>
          <div className="kv">
            <span>Team</span>
            <span>
              {team.name} · {team.college.replace(' University', '')}
            </span>
          </div>
          <div className="kv">
            <span>Joining as</span>
            <span>
              {draft.role === 'parent'
                ? 'Parent of ' + child
                : draft.role === 'teen'
                  ? 'Teammate'
                  : 'Athlete'}
            </span>
          </div>
          <div className="kv">
            <span>Status</span>
            <span>{approved ? 'Approved' : 'Pending'}</span>
          </div>
        </div>
      </div>
      <div className="stack g10">
        {approved ? (
          <button className="btn btn-primary btn-lg btn-full" onClick={() => nav.go('signed')}>
            Continue
          </button>
        ) : (
          <button
            className="btn btn-lg btn-full"
            style={{
              border: '1.5px dashed var(--navy)',
              background: 'var(--navy-tint)',
              color: 'var(--navy-pressed)',
            }}
            onClick={() => {
              if (req) update(setRequest(req.id, 'approved'));
              nav.go('signed');
            }}
          >
            Prototype: coach approves
          </button>
        )}
        <button className="btn btn-ghost btn-full" onClick={() => nav.go('scan')}>
          Got a QR code from the coach? Scan it
        </button>
        {!approved && (
          <button
            className="btn btn-ghost btn-full"
            style={{ color: 'var(--danger)' }}
            onClick={() => {
              if (req) update(dropRequest(req.id));
              nav.back();
            }}
          >
            Cancel request
          </button>
        )}
      </div>
    </Screen>
  );
}

/* ---------------- Scan QR ---------------- */
export function ScanQR() {
  const { nav, draft, setDraft } = useApp();
  const { world, update } = useWorld();
  const pre = nav.params.pre === '1';
  const team = world.teams.find((t) => t.id === 'ws')!;
  const join = () => {
    setDraft((d) => ({ ...d, teamId: team.id, via: 'qr' }));
    if (pre) {
      nav.go('account');
      return;
    }
    const req = world.joinRequests.find((r) => r.id === draft.requestId);
    if (req && req.status === 'pending') update(setRequest(req.id, 'approved'));
    else update(bumpMembers(team.id, 1));
    nav.go('signed');
  };
  return (
    <div className="screen m-dark" style={{ position: 'relative', minHeight: '100%' }}>
      <div className="row between" style={{ position: 'absolute', top: 52, left: 20, right: 20 }}>
        <button
          className="icon-btn"
          aria-label="Close"
          onClick={nav.back}
          style={{
            borderRadius: '50%',
            background: 'rgba(255,255,255,.12)',
            color: 'var(--ground)',
          }}
        >
          <Icon name="close" />
        </button>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Scan team code</div>
        <span style={{ width: 44 }} />
      </div>
      <div
        style={{
          position: 'absolute',
          top: 160,
          left: 65,
          width: 260,
          height: 260,
          borderRadius: 24,
          border: '3px solid var(--ground)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#8D939C',
          fontSize: 14,
        }}
      >
        Camera view
      </div>
      <div
        style={{
          position: 'absolute',
          top: 440,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: 15,
          color: '#B9BDC4',
        }}
      >
        Point at the code your coach shared
      </div>
      <div
        className="stack g16"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--ground)',
          color: 'var(--ink)',
          borderRadius: '24px 24px 0 0',
          padding: '12px 20px 28px',
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
        <div className="eyebrow" style={{ color: '#0F7B5F' }}>
          CODE FOUND
        </div>
        <div className="row g14">
          <span
            className="tile"
            style={{ width: 52, height: 52, background: team.color, fontSize: 22 }}
          >
            {team.abbr}
          </span>
          <div className="stack" style={{ gap: 2 }}>
            <div
              style={{
                fontFamily: 'var(--display)',
                fontWeight: 800,
                fontSize: 26,
                textTransform: 'uppercase',
                lineHeight: 1,
              }}
            >
              {team.name}
            </div>
            <div className="small" style={{ color: 'var(--muted)' }}>
              Tufts · shared by {team.coach} · expires Tue
            </div>
          </div>
        </div>
        <p className="small" style={{ margin: 0 }}>
          A coach’s code skips the wait.{' '}
          {pre ? 'Make your account next and you join straight away.' : 'You join straight away.'}
        </p>
        <button className="btn btn-primary btn-lg btn-full" onClick={join}>
          {pre ? 'Continue to sign up' : 'Join the team'}
        </button>
      </div>
    </div>
  );
}

/* ---------------- Verify (recruiter) ---------------- */
export function Verify() {
  const { nav, draft } = useApp();
  return (
    <Screen style={{ padding: '72px 24px 28px', gap: 16 }}>
      <span
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'var(--navy-tint)',
          color: 'var(--navy)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="mail" size={28} />
      </span>
      <Title size={44}>Check your work email</Title>
      <p className="body" style={{ fontSize: 17 }}>
        We sent a link to {draft.email || 'your work address'}. Open it on this phone to finish.
      </p>
      <button
        className="btn btn-lg btn-full mt-auto"
        style={{
          border: '1.5px dashed var(--navy)',
          background: 'var(--navy-tint)',
          color: 'var(--navy-pressed)',
        }}
        onClick={() => nav.go('signed')}
      >
        Prototype: open the link
      </button>
      <BackBtn label="Use a different email" />
    </Screen>
  );
}

/* ---------------- Signed ---------------- */
export function Signed() {
  const { draft, become, setLocal } = useApp();
  const { world } = useWorld();
  const team = world.teams.find((t) => t.id === draft.teamId) ?? world.teams[0]!;
  const r = draft.role,
    first = (draft.name.trim() || 'there').split(' ')[0] ?? 'there',
    child = draft.child.trim() || 'Leo';
  const enter = (screen?: ScreenId) => {
    if (r === 'parent')
      setLocal((l) => ({
        ...l,
        child: { ...l.child, name: child, age: draft.childAge || l.child.age },
      }));
    become(r, { name: draft.name.trim() || undefined, fresh: true, screen });
  };
  const d =
    r === 'coach'
      ? {
          word: 'COACH',
          title: 'You’re coaching ' + team.name,
          text: 'Approve requests, make a join code, and say hi to your team.',
          cta: 'Go to my team',
          alt: { label: 'Make a join QR code', screen: 'coachQR' as const },
        }
      : r === 'alumni'
        ? {
            word: 'WELCOME',
            title: 'Welcome back, ' + first,
            text: 'You’re in the Team IMPACT alumni network. Athletes looking for mentors can find you.',
            cta: 'Go to the community',
            alt: {
              label: 'Have a card invite from staff? Claim it',
              screen: 'alumniInvite' as const,
            },
          }
        : r === 'recruiter'
          ? {
              word: 'VERIFIED',
              title: 'You’re in, ' + first,
              text: 'Start reviewing athletes who are open to recruiting. Swipe right to save, left to skip.',
              cta: 'Start reviewing',
              alt: null,
            }
          : {
              word: 'SIGNED',
              title: 'Welcome to ' + team.name,
              text:
                r === 'parent'
                  ? `You and ${child} are on the team. Say hi to the roster and see what’s coming up.`
                  : r === 'teen'
                    ? `You’re on the team, ${first}. Post to your team and say hi.`
                    : `You’re on the roster, ${first}. Next up: build your Baseball Card.`,
              cta: 'Go to my team',
              alt:
                r === 'parent'
                  ? { label: 'Finish ' + child + '’s profile', screen: 'child' as const }
                  : r === 'athlete'
                    ? { label: 'Build my Baseball Card', screen: 'card' as const }
                    : null,
            };
  return (
    <div className="m-screen m-red" style={{ padding: '56px 24px 28px', gap: 28 }}>
      <div
        className="stack grow"
        style={{ alignItems: 'center', justifyContent: 'center', gap: 36 }}
      >
        <div
          className="stamp stack"
          style={{
            border: '6px solid #fff',
            borderRadius: 18,
            padding: '14px 30px',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--display)',
              fontWeight: 800,
              fontSize: d.word.length > 6 ? 64 : 88,
              lineHeight: 0.9,
            }}
          >
            {d.word}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.2em' }}>OCT 7, 2026</div>
        </div>
        <div className="rise stack g10" style={{ alignItems: 'center', textAlign: 'center' }}>
          <h1 className="display d-36" style={{ color: '#fff' }}>
            {d.title}
          </h1>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, maxWidth: 300 }}>{d.text}</p>
        </div>
      </div>
      <div className="rise stack g10">
        <button className="btn btn-white btn-lg btn-full" onClick={() => enter()}>
          {d.cta}
        </button>
        {d.alt &&
          (() => {
            const alt = d.alt;
            return (
              <button
                className="btn btn-full"
                style={{ background: 'transparent', color: '#fff' }}
                onClick={() => enter(alt.screen)}
              >
                {alt.label}
              </button>
            );
          })()}
      </div>
    </div>
  );
}

/* ---------------- Alumni: claim a pre-built card ---------------- */
export function AlumniInvite() {
  const { nav, toast } = useApp();
  const [claimed, setClaimed] = useState(false);
  return (
    <Screen style={{ gap: 16 }}>
      <BackBtn />
      <Head
        eyebrow="PERSONAL INVITE FOR JAMAL"
        title="We saved your card"
        sub="Team IMPACT built this from your public profile. Nobody can see it until you claim it."
      />
      <div
        className="deal"
        style={{
          alignSelf: 'center',
          width: 250,
          borderRadius: 18,
          overflow: 'hidden',
          background: 'var(--navy)',
          color: '#fff',
          boxShadow: '0 14px 30px rgba(17,20,24,.22)',
        }}
      >
        <div style={{ height: 8, background: 'var(--red)' }} />
        <div
          style={{
            height: 130,
            background: 'var(--photo)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6B6559',
            fontSize: 13,
            fontWeight: 600,
            position: 'relative',
          }}
        >
          Photo
          <div
            style={{
              position: 'absolute',
              left: 10,
              top: 6,
              fontFamily: 'var(--display)',
              fontWeight: 800,
              fontSize: 44,
            }}
          >
            ALUM
          </div>
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
            Jamal Wright
          </div>
          <div style={{ fontSize: 13, color: 'var(--on-navy)' }}>
            Men’s Lacrosse · Boston College ’19
          </div>
          <div style={{ fontSize: 13, color: 'var(--on-navy)' }}>Analyst at Fidelity</div>
        </div>
      </div>
      {claimed ? (
        <Notice tone="ok" icon="check">
          Claimed. It stays hidden until you publish it from Me.
        </Notice>
      ) : (
        <div className="panel small" style={{ padding: '12px 14px' }}>
          Anything wrong? You’ll review every field before it goes live, and you can delete it
          instead.
        </div>
      )}
      <div className="stack g10 mt-auto">
        {claimed ? (
          <button className="btn btn-primary btn-lg btn-full" onClick={() => nav.reset('home')}>
            Go to the community
          </button>
        ) : (
          <button
            className="btn btn-primary btn-lg btn-full"
            onClick={() => {
              setClaimed(true);
              toast('Card claimed');
            }}
          >
            Claim and review my card
          </button>
        )}
        {!claimed && (
          <button
            className="btn btn-ghost btn-full"
            onClick={() => {
              toast('Thanks. We told Team IMPACT staff.');
              nav.back();
            }}
          >
            This isn’t me
          </button>
        )}
      </div>
    </Screen>
  );
}
