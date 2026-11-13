import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import type { Role } from '@team-impact/contracts';
import { colors, radius, spacing } from '@team-impact/ui-tokens';
import { homeFor, isPortalRole, useSession } from '../session';
import { Logo, Text } from '../ui';

const CHOICES: { role: Role; title: string; who: string; detail: string }[] = [
  {
    role: 'recruiter',
    title: 'Recruiter',
    who: 'Elena Ward · Northbeam Capital',
    detail: 'Search athletes, open Impact Cards, keep shared lists.',
  },
  {
    role: 'staff',
    title: 'Team Impact staff',
    who: 'Maya Chen · Team Impact',
    detail: 'Teams, companies, moderation tickets and communities.',
  },
];

/**
 * While the API runs on mocks there are no passwords: pick a role and you're signed in as its
 * fixture user. The real sign-in form replaces this once auth lands.
 */
export const SignInPage = () => {
  const { me, signIn } = useSession();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [error, setError] = useState<string | null>(null);

  if (me && isPortalRole(me.role)) return <Navigate to={homeFor(me.role)} replace />;

  const choose = (role: Role) =>
    signIn(role).then(
      (signedIn) => navigate(from ?? homeFor(signedIn.role), { replace: true }),
      (e: Error) => setError(e.message),
    );

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div
        style={{
          width: '38%',
          background: colors.brand,
          padding: spacing['3xl'],
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: spacing.lg,
        }}
      >
        <Logo size="md" variant="dark" />
        <Text variant="eyebrow" color="on-brand-secondary">
          Team IMPACT portal
        </Text>
        <Text variant="display" size="xl" color="on-brand">
          Find athletes who show up for their team.
        </Text>
        <Text color="on-brand-secondary" style={{ maxWidth: 420 }}>
          For recruiters at partner companies and for Team Impact staff. Athletes, families and
          coaches use the app.
        </Text>
      </div>

      <main
        style={{
          flex: 1,
          background: colors.ground,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
        }}
      >
        <div style={{ width: '100%', maxWidth: 460 }}>
          <Text variant="eyebrow" color="secondary">
            Mock data · no password
          </Text>
          <Text
            as="h2"
            variant="display"
            size="md"
            color="brand"
            style={{ margin: `${spacing.sm}px 0 ${spacing.lg}px` }}
          >
            Sign in as
          </Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {CHOICES.map((c) => (
              <button
                key={c.role}
                type="button"
                onClick={() => choose(c.role)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: spacing.xs,
                  textAlign: 'left',
                  padding: spacing.lg,
                  borderRadius: radius.xl,
                  border: `1px solid ${colors.line}`,
                  background: colors.surface,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <Text as="span" variant="display" size="xs" color="brand">
                  {c.title}
                </Text>
                <Text as="span" variant="small">
                  {c.who}
                </Text>
                <Text as="span" variant="small" color="muted">
                  {c.detail}
                </Text>
              </button>
            ))}
          </div>
          <Text variant="small" color="secondary" style={{ marginTop: spacing.lg }}>
            Recruiter at a partner company? <Link to="/sign-up">Create an account</Link>
          </Text>
          {me && !isPortalRole(me.role) && (
            <Text role="alert" color="danger" style={{ marginTop: spacing.md }}>
              The portal is for recruiters and staff. Use the Team Impact app.
            </Text>
          )}
          {error && (
            <Text role="alert" color="danger" style={{ marginTop: spacing.md }}>
              {error}. Is the API running with MOCK_API=1?
            </Text>
          )}
        </div>
      </main>
    </div>
  );
};
