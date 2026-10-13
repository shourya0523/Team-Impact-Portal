import { NavLink, Outlet, useNavigate } from 'react-router';
import type { Role } from '@team-impact/contracts';
import { fontSize, spacing } from '@team-impact/ui-tokens';
import { useSession } from './session';
import { brand, fullName, initials } from './ui';

/** Each role's sidebar. A role never gets a link to a page its routes would refuse. */
const NAV: Partial<Record<Role, { to: string; label: string }[]>> = {
  recruiter: [
    { to: '/search', label: 'Search' },
    { to: '/lists', label: 'Lists' },
  ],
  staff: [
    { to: '/staff/teams', label: 'Teams' },
    { to: '/staff/companies', label: 'Companies' },
    { to: '/staff/moderation', label: 'Moderation' },
    { to: '/staff/communities', label: 'Communities' },
  ],
};

const SECTION_NAME: Partial<Record<Role, string>> = {
  recruiter: 'Recruiter portal',
  staff: 'Staff',
};

export const Layout = () => {
  const { me, signOut } = useSession();
  const navigate = useNavigate();
  if (!me) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: brand.page }}>
      <aside
        style={{
          width: 232,
          flexShrink: 0,
          background: brand.navy,
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          padding: spacing.md,
          position: 'sticky',
          top: 0,
          height: '100vh',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ padding: `${spacing.lg}px ${spacing.sm}px ${spacing.xl}px` }}>
          <div style={{ fontWeight: 800, fontSize: fontSize.lg }}>Team IMPACT</div>
          <div
            style={{
              marginTop: 2,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              opacity: 0.8,
            }}
          >
            {SECTION_NAME[me.role]}
          </div>
        </div>

        <nav aria-label="Main" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(NAV[me.role] ?? []).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                padding: `${spacing.sm + 2}px ${spacing.sm + 4}px`,
                borderRadius: 10,
                fontWeight: 700,
                fontSize: fontSize.sm + 1,
                textDecoration: 'none',
                background: isActive ? '#FFFFFF' : 'transparent',
                color: isActive ? brand.navy : '#FFFFFF',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <span
            aria-hidden="true"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background: brand.red,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {initials(me)}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: fontSize.sm }}>{fullName(me)}</div>
            <button
              type="button"
              onClick={() => signOut().then(() => navigate('/sign-in'))}
              style={{
                padding: 0,
                border: 'none',
                background: 'none',
                color: '#FFFFFF',
                opacity: 0.8,
                fontSize: 12,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, padding: `${spacing.xl}px ${spacing.xl + 8}px` }}>
        <Outlet />
      </main>
    </div>
  );
};
