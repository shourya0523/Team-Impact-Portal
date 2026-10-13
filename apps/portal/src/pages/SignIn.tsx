import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import type { Role } from '@team-impact/contracts';
import { fontSize, spacing } from '@team-impact/ui-tokens';
import { homeFor, isPortalRole, useSession } from '../session';
import { brand } from '../ui';

const CHOICES: { role: Role; title: string; who: string; detail: string }[] = [
  {
    role: 'recruiter',
    title: 'Recruiter',
    who: 'Elena Ward · Northbeam Capital',
    detail: 'Search athletes, open Baseball Cards, keep shared lists.',
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
          background: brand.navy,
          color: '#FFFFFF',
          padding: 64,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', opacity: 0.85 }}>
          TEAM IMPACT PORTAL
        </div>
        <h1 style={{ fontSize: 48, lineHeight: 1.05, fontWeight: 800, margin: '24px 0' }}>
          Find athletes who show up for their team.
        </h1>
        <p style={{ fontSize: fontSize.md, lineHeight: 1.6, opacity: 0.9, maxWidth: 420 }}>
          For recruiters at partner companies and for Team Impact staff. Athletes, families and
          coaches use the app.
        </p>
      </div>

      <main
        style={{
          flex: 1,
          background: brand.page,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
        }}
      >
        <div style={{ width: '100%', maxWidth: 460 }}>
          <div style={{ color: brand.red, fontWeight: 700, fontSize: 12, letterSpacing: '0.12em' }}>
            MOCK DATA · NO PASSWORD
          </div>
          <h2 style={{ fontSize: 30, color: brand.navy, margin: '8px 0 24px', fontWeight: 800 }}>
            Sign in as
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {CHOICES.map((c) => (
              <button
                key={c.role}
                type="button"
                onClick={() => choose(c.role)}
                style={{
                  textAlign: 'left',
                  padding: spacing.lg,
                  borderRadius: 16,
                  border: `1px solid ${brand.border}`,
                  background: brand.surface,
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: fontSize.lg, fontWeight: 800, color: brand.navy }}>
                  {c.title}
                </div>
                <div style={{ fontSize: fontSize.sm, color: brand.ink, marginTop: 4 }}>{c.who}</div>
                <div style={{ fontSize: fontSize.sm, color: brand.muted, marginTop: 8 }}>
                  {c.detail}
                </div>
              </button>
            ))}
          </div>
          {me && !isPortalRole(me.role) && (
            <p role="alert" style={{ color: brand.red }}>
              The portal is for recruiters and staff. Use the Team Impact app.
            </p>
          )}
          {error && (
            <p role="alert" style={{ color: brand.red }}>
              {error}. Is the API running with MOCK_API=1?
            </p>
          )}
        </div>
      </main>
    </div>
  );
};
