import { useState } from 'react';
import { useWorld } from '../../shared/store';
import { Icon, Logo } from '../../shared/ui';
import { Brand } from '../chrome';
import { checkEmail, type DomainCheck } from '../logic';

export type SignupDraft = {
  name: string;
  title: string;
  email: string;
  password: string;
  terms: boolean;
};

function emailMessage(c: DomainCheck): { tone: 'ok' | 'err' | 'warn'; text: string } | null {
  switch (c.kind) {
    case 'empty':
      return { tone: 'err', text: 'Enter your work email.' };
    case 'format':
      return { tone: 'err', text: 'That does not look like an email address.' };
    case 'personal':
      return {
        tone: 'err',
        text: `Use your work email. Personal addresses like ${c.domain} are turned away.`,
      };
    case 'unknown':
      return {
        tone: 'err',
        text: `We don't recognize ${c.domain}. Ask your company to set up a Team IMPACT partnership first.`,
      };
    case 'pending':
      return {
        tone: 'err',
        text: `${c.company.name} isn't set up yet. Team IMPACT will email your company contact when it's ready.`,
      };
    case 'suspended':
      return {
        tone: 'warn',
        text: `${c.company.name}'s account is suspended, so new sign-ups are paused. Contact partnerships@teamimpact.org.`,
      };
    case 'ok':
      return {
        tone: 'ok',
        text: `${c.company.name} is a Team IMPACT partner. You're in once you verify.`,
      };
  }
}

export function Signup({
  draft,
  setDraft,
  onCreated,
  onSignIn,
}: {
  draft: SignupDraft;
  setDraft: (d: SignupDraft) => void;
  onCreated: () => void;
  onSignIn: () => void;
}) {
  const { world } = useWorld();
  const [tried, setTried] = useState(false);
  const check = checkEmail(world, draft.email);
  const emailMsg = emailMessage(check);
  const errs = {
    name: !draft.name.trim() ? 'Enter your full name.' : '',
    title: !draft.title.trim() ? 'Enter your job title.' : '',
    email: check.kind !== 'ok' ? (emailMsg?.text ?? '') : '',
    password: draft.password.length < 8 ? 'Use at least 8 characters.' : '',
    terms: !draft.terms ? 'Agree to the recruiter terms to continue.' : '',
  };
  const valid = Object.values(errs).every((e) => !e);
  const set = (k: keyof SignupDraft, v: string | boolean) => setDraft({ ...draft, [k]: v });
  const showEmail = tried || (draft.email.includes('@') && draft.email.includes('.'));
  const emailBorder = !showEmail ? undefined : check.kind === 'ok' ? '#0F7B5F' : 'var(--danger)';

  return (
    <div className="row wrap" style={{ minHeight: 'calc(100vh - 44px)', alignItems: 'stretch' }}>
      <div
        className="stack g24"
        style={{
          flex: '1 1 420px',
          background: 'var(--navy)',
          color: '#fff',
          padding: 'clamp(28px, 5vw, 56px) clamp(20px, 5vw, 64px)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div className="row g12">
          <Logo size={48} boxed />
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '.12em' }}>
            RECRUITER PORTAL
          </div>
        </div>
        <h1
          className="display"
          style={{
            color: '#fff',
            fontSize: 'clamp(44px, 6vw, 72px)',
            lineHeight: 0.9,
            marginTop: 'auto',
            maxWidth: 560,
          }}
        >
          Hire athletes who show up <span style={{ color: '#FF8A99' }}>for their team.</span>
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 18,
            lineHeight: 1.5,
            color: 'var(--navy-tint)',
            maxWidth: 480,
          }}
        >
          Search Baseball Cards from Team IMPACT athletes who chose to be found, save them to shared
          lists, and reach out directly.
        </p>
        <div className="row g6">
          <span style={{ height: 8, width: 80, background: 'var(--red)', borderRadius: 4 }} />
          <span style={{ height: 8, width: 24, background: '#fff', borderRadius: 4 }} />
        </div>
      </div>
      <div
        className="row center"
        style={{ flex: '999 1 520px', minWidth: 0, padding: '48px 16px' }}
      >
        <form
          className="stack g16 screen"
          style={{ width: '100%', maxWidth: 440 }}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setTried(true);
            if (valid) onCreated();
          }}
        >
          <div className="eyebrow red">Create your account</div>
          <h2 className="display d-44">Sign up with your work email</h2>
          <div className="grid2" style={{ gap: 12 }}>
            <div className="field">
              <label className="label" htmlFor="su-name">
                Full name
              </label>
              <input
                id="su-name"
                className={'input' + (tried && errs.name ? ' err' : '')}
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                autoComplete="name"
              />
              {tried && errs.name && (
                <div className="err-text" role="alert">
                  {errs.name}
                </div>
              )}
            </div>
            <div className="field">
              <label className="label" htmlFor="su-title">
                Job title
              </label>
              <input
                id="su-title"
                className={'input' + (tried && errs.title ? ' err' : '')}
                value={draft.title}
                onChange={(e) => set('title', e.target.value)}
                autoComplete="organization-title"
              />
              {tried && errs.title && (
                <div className="err-text" role="alert">
                  {errs.title}
                </div>
              )}
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="su-email">
              Work email
            </label>
            <input
              id="su-email"
              type="email"
              className="input"
              style={emailBorder ? { borderColor: emailBorder, borderWidth: 2 } : undefined}
              value={draft.email}
              onChange={(e) => set('email', e.target.value)}
              autoComplete="email"
              aria-describedby="su-email-msg"
              aria-invalid={showEmail && check.kind !== 'ok'}
            />
            <div id="su-email-msg" aria-live="polite">
              {showEmail &&
                emailMsg &&
                (emailMsg.tone === 'ok' ? (
                  <div style={{ fontSize: 13, color: '#0B5A45', fontWeight: 600 }}>
                    {emailMsg.text}
                  </div>
                ) : emailMsg.tone === 'warn' ? (
                  <div
                    className="notice-warn row g8"
                    role="alert"
                    style={{ alignItems: 'flex-start' }}
                  >
                    <Icon name="lock" size={18} />
                    <span>
                      <b>Account suspended.</b> {emailMsg.text}
                    </span>
                  </div>
                ) : (
                  <div className="err-text" role="alert">
                    {emailMsg.text}
                  </div>
                ))}
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="su-pw">
              Password
            </label>
            <input
              id="su-pw"
              type="password"
              className={'input' + (tried && errs.password ? ' err' : '')}
              value={draft.password}
              onChange={(e) => set('password', e.target.value)}
              autoComplete="new-password"
            />
            {tried && errs.password ? (
              <div className="err-text" role="alert">
                {errs.password}
              </div>
            ) : (
              <div className="tiny">At least 8 characters.</div>
            )}
          </div>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              background: 'var(--red-tint)',
              color: '#8A1C2C',
              fontSize: 14,
              lineHeight: 1.45,
            }}
          >
            Personal addresses like gmail.com are turned away, and so are companies Team IMPACT
            hasn't set up yet.
          </div>
          <div className="stack g4">
            <label className="check">
              <input
                type="checkbox"
                checked={draft.terms}
                onChange={(e) => set('terms', e.target.checked)}
              />
              I agree to the recruiter terms. I'll only contact athletes about real opportunities.
            </label>
            {tried && errs.terms && (
              <div className="err-text" role="alert">
                {errs.terms}
              </div>
            )}
          </div>
          <button type="submit" className="btn btn-primary btn-lg btn-full">
            Create account
          </button>
          <div className="small" style={{ textAlign: 'center' }}>
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSignIn}
              className="btn-ghost"
              style={{
                border: 0,
                background: 'none',
                fontWeight: 600,
                color: 'var(--navy)',
                textDecoration: 'underline',
                cursor: 'pointer',
                minHeight: 44,
                padding: '0 4px',
              }}
            >
              Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Verify({
  email,
  onOpen,
  onChange,
  toast,
}: {
  email: string;
  onOpen: () => void;
  onChange: () => void;
  toast: (m: string) => void;
}) {
  const { world } = useWorld();
  const check = checkEmail(world, email);
  const companyName =
    check.kind === 'ok' || check.kind === 'suspended' || check.kind === 'pending'
      ? check.company.name
      : 'your company';
  const blocked = check.kind !== 'ok';
  return (
    <div className="stack" style={{ minHeight: 'calc(100vh - 44px)' }}>
      <div className="topnav">
        <Brand size={36} />
      </div>
      <div className="row center" style={{ flexGrow: 1, padding: '48px 16px' }}>
        <div
          className="stack g20 screen"
          style={{ width: '100%', maxWidth: 520, alignItems: 'center', textAlign: 'center' }}
        >
          <div
            className="stamp"
            style={{
              width: 96,
              height: 96,
              borderRadius: 28,
              background: 'var(--red)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="mail" size={44} stroke={1.6} />
          </div>
          <h1 className="display" style={{ fontSize: 'clamp(40px, 8vw, 56px)' }}>
            Check your inbox
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 18,
              lineHeight: 1.5,
              color: '#2A2E35',
              overflowWrap: 'anywhere',
            }}
          >
            We sent a link to <b style={{ fontWeight: 600 }}>{email.trim()}</b>. Click it to join{' '}
            {companyName}'s account and start searching.
          </p>
          {blocked && (
            <div className="notice-warn" role="alert">
              {companyName}'s account can't take new recruiters right now. Contact
              partnerships@teamimpact.org.
            </div>
          )}
          <div className="row g12 wrap center">
            <button className="btn btn-navy" onClick={onOpen} disabled={blocked}>
              Open the link
            </button>
            <button
              className="btn btn-quiet"
              onClick={() => toast('Sent again. It can take a minute to arrive.')}
            >
              Resend email
            </button>
          </div>
          <div className="tiny">Prototype: "Open the link" stands in for clicking the email.</div>
          <div className="small">
            Wrong address?{' '}
            <button
              onClick={onChange}
              style={{
                border: 0,
                background: 'none',
                fontWeight: 600,
                color: 'var(--navy)',
                textDecoration: 'underline',
                cursor: 'pointer',
                minHeight: 44,
                padding: '0 4px',
                fontSize: 14,
              }}
            >
              Change it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
