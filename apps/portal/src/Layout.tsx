import { NavLink, Outlet, useNavigate } from 'react-router';
import type { Role } from '@team-impact/contracts';
import { colors, fontWeight, layout, radius, spacing, typography } from '@team-impact/ui-tokens';
import { useSession } from './session';
import { Avatar, fullName, Logo, Text } from './ui';

/** Each role's sidebar. A role never gets a link to a page its routes would refuse. */
const NAV: Partial<Record<Role, { to: string; label: string }[]>> = {
  recruiter: [
    { to: '/search', label: 'Search' },
    { to: '/lists', label: 'Lists' },
  ],
  staff: [
    { to: '/staff/teams', label: 'Teams' },
    { to: '/staff/colleges', label: 'Colleges' },
    { to: '/staff/companies', label: 'Companies' },
    { to: '/staff/moderation', label: 'Moderation' },
    { to: '/staff/communities', label: 'Communities' },
    { to: '/staff/announcements', label: 'Announcements' },
  ],
};

/** Avatar colour per portal role, from the shared role palette. */
const ROLE_COLOR: Partial<Record<Role, string>> = {
  recruiter: colors.role.recruiter,
  staff: colors.role.staff,
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
    <div style={{ display: 'flex', minHeight: '100vh', background: colors.ground }}>
      <aside
        style={{
          width: 232,
          flexShrink: 0,
          background: colors.brand,
          color: colors.onBrand.text,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.xl,
          padding: spacing.md,
          position: 'sticky',
          top: 0,
          height: '100vh',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: spacing.sm,
            padding: `${spacing.lg}px ${spacing.sm}px 0`,
          }}
        >
          <Logo size="sm" variant="dark" />
          <Text variant="eyebrow" color="on-brand-secondary">
            {SECTION_NAME[me.role]}
          </Text>
        </div>

        <nav
          aria-label="Main"
          style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, flex: 1 }}
        >
          {(NAV[me.role] ?? []).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                minHeight: layout.minTouchTarget,
                padding: `0 ${spacing.md}px`,
                borderRadius: radius.sm,
                fontWeight: fontWeight.semibold,
                fontSize: typography.body.fontSize,
                textDecoration: 'none',
                background: isActive ? colors.surface : 'transparent',
                color: isActive ? colors.brand : colors.onBrand.text,
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <Avatar name={fullName(me)} size="sm" color={ROLE_COLOR[me.role] ?? colors.brand} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text variant="small" weight="semibold" color="on-brand">
              {fullName(me)}
            </Text>
            <button
              type="button"
              onClick={() => signOut().then(() => navigate('/sign-in'))}
              className="ti-text ti-text--caption ti-color--on-brand-secondary"
              style={{
                padding: 0,
                border: 'none',
                background: 'none',
                fontFamily: 'inherit',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, padding: `${spacing.xl}px ${spacing['2xl']}px` }}>
        <Outlet />
      </main>
    </div>
  );
};
