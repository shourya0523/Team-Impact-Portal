import { useState } from 'react';
import { Avatar, Icon, Logo } from '../shared/ui';
import type { Account, Screen } from './logic';

export const Brand = ({ size = 34 }: { size?: number }) => (
  <div className="row g10">
    <Logo size={size} />
    <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.12em', color: 'var(--navy)' }}>
      RECRUITER PORTAL
    </div>
  </div>
);

/** Small jersey-number tile used in results and lists. */
export const Jersey = ({
  num,
  w = 46,
  h = 58,
  font = 18,
  color = 'var(--navy)',
}: {
  num: string;
  w?: number;
  h?: number;
  font?: number;
  color?: string;
}) => (
  <span
    aria-hidden="true"
    style={{
      width: w,
      height: h,
      flexShrink: 0,
      borderRadius: 8,
      background: color,
      color: '#fff',
      display: 'flex',
      alignItems: 'flex-start',
      padding: '3px 6px',
      fontFamily: 'var(--display)',
      fontWeight: 800,
      fontSize: font,
    }}
  >
    {num}
  </span>
);

const NAV: [Screen, string][] = [
  ['search', 'Search'],
  ['lists', 'Lists'],
  ['saved', 'Saved searches'],
  ['jd', 'Job match'],
  ['post', 'Post to a group'],
];
const SECTION: Partial<Record<Screen, Screen>> = { athlete: 'search', list: 'lists' };

export function TopNav({
  screen,
  account,
  companyName,
  onNav,
  onSignOut,
}: {
  screen: Screen;
  account: Account;
  companyName: string;
  onNav: (s: Screen) => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const cur = SECTION[screen] ?? screen;
  return (
    <header className="topnav">
      <Brand />
      <nav aria-label="Portal">
        {NAV.map(([s, l]) => (
          <button
            key={s}
            className="navlink"
            aria-current={cur === s ? 'page' : undefined}
            onClick={() => onNav(s)}
          >
            {l}
          </button>
        ))}
      </nav>
      <div className="row g10" style={{ marginLeft: 'auto', position: 'relative' }}>
        <div className="small">{companyName}</div>
        <button
          aria-label={`Account menu for ${account.name}`}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((o) => !o)}
          style={{
            border: 0,
            background: 'none',
            padding: 0,
            cursor: 'pointer',
            borderRadius: '50%',
            minWidth: 44,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Avatar name={account.name} size={36} />
        </button>
        {open && (
          <>
            <button
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'transparent',
                border: 0,
                zIndex: 30,
                cursor: 'default',
              }}
            />
            <div
              role="menu"
              className="panel stack"
              style={{
                position: 'absolute',
                right: 0,
                top: 52,
                width: 260,
                zIndex: 31,
                padding: 8,
                boxShadow: '0 14px 40px rgba(17,20,24,.16)',
              }}
            >
              <div className="stack g4" style={{ padding: '8px 10px 10px' }}>
                <div className="strong">{account.name}</div>
                <div className="tiny">
                  {account.title} · {companyName}
                </div>
                <div className="tiny">{account.email}</div>
              </div>
              <button
                role="menuitem"
                className="btn btn-ghost"
                style={{ justifyContent: 'flex-start' }}
                onClick={() => {
                  setOpen(false);
                  onNav('saved');
                }}
              >
                <Icon name="bell" size={18} />
                Digests and saved searches
              </button>
              <button
                role="menuitem"
                className="btn btn-ghost"
                style={{ justifyContent: 'flex-start', color: 'var(--danger)' }}
                onClick={() => {
                  setOpen(false);
                  onSignOut();
                }}
              >
                <Icon name="back" size={18} />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

export function SuspendedBanner({ companyName }: { companyName: string }) {
  return (
    <div
      role="alert"
      className="row g12"
      style={{
        background: 'var(--red-tint)',
        color: '#8A1C2C',
        borderRadius: 14,
        padding: '14px 16px',
        alignItems: 'flex-start',
      }}
    >
      <Icon name="lock" />
      <div className="stack g4">
        <div className="strong">{companyName}'s account is suspended</div>
        <div style={{ fontSize: 14, lineHeight: 1.45 }}>
          Team IMPACT has paused access for everyone at {companyName}. Search, athlete cards and
          posting are turned off. Your lists are kept. Contact partnerships@teamimpact.org to
          restore access.
        </div>
      </div>
    </div>
  );
}

export function Blocked({ what }: { what: string }) {
  return (
    <div
      className="dashed stack g10"
      style={{ padding: '36px 20px', alignItems: 'center', textAlign: 'center' }}
    >
      <Icon name="lock" size={28} />
      <div className="display d-28">{what} is paused</div>
      <div className="small" style={{ maxWidth: 420 }}>
        This comes back as soon as Team IMPACT restores your company's account.
      </div>
    </div>
  );
}
