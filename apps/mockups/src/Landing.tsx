import { Icon, Logo } from './shared/ui';

const surfaces = [
  {
    href: '#/app',
    eyebrow: 'Expo app · athletes, families, coaches, alumni, recruiters',
    title: 'Mobile app',
    icon: 'card',
    points: [
      'Sign up by role, with age rules and per-role house rules',
      'Join a team by request or coach QR code, ending in the Signed stamp',
      'Feed, events, affinity groups, roster and coach tools',
      'Resume upload to a published Baseball Card',
      'Recruiter swipe review and shared lists',
    ],
  },
  {
    href: '#/portal',
    eyebrow: 'Web · verified company recruiters',
    title: 'Recruiter portal',
    icon: 'search',
    points: [
      'Work-email sign-up and verification',
      'Search with filters, including identity search when staff turn it on',
      'Athlete cards, team notes and shared lists',
      'Saved searches, job-description matching and group posts',
    ],
  },
  {
    href: '#/staff',
    eyebrow: 'Web · Team IMPACT staff',
    title: 'Staff portal',
    icon: 'shield',
    points: [
      'Teams and first-coach invites',
      'Company onboarding and suspension',
      'Moderation tickets with logged actions',
      'Official groups, the identity search flag, announcements, analytics and alumni cards',
    ],
  },
];

export default function Landing() {
  return (
    <div className="container" style={{ maxWidth: 1180 }}>
      <div className="row g14" style={{ marginTop: 12 }}>
        <Logo size={56} />
        <div className="stack g4">
          <div className="eyebrow red">Hi-fi mockups · Signing Day design language</div>
          <h1 className="display d-56">Team IMPACT platform</h1>
        </div>
      </div>
      <p className="body" style={{ maxWidth: 760 }}>
        Three clickable mockups built from PRD v2. They share one set of demo data, so what you do
        in one shows up in the others. Turn off open to recruiting in the app and that athlete
        leaves the recruiter portal. Mark a group official in the staff portal and it becomes a
        recruiter filter. Use <b>Reset demo data</b> in the top bar to start over.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 16,
        }}
      >
        {surfaces.map((s) => (
          <a
            key={s.href}
            href={s.href}
            className="panel stack g12"
            style={{
              padding: 24,
              textDecoration: 'none',
              color: 'var(--ink)',
              borderTop: '6px solid var(--red)',
            }}
          >
            <div className="row between">
              <span className="eyebrow">{s.eyebrow}</span>
              <span style={{ color: 'var(--navy)' }}>
                <Icon name={s.icon} size={26} />
              </span>
            </div>
            <h2 className="display d-40">{s.title}</h2>
            <ul
              className="small"
              style={{
                margin: 0,
                paddingLeft: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {s.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <span className="btn btn-primary mt-auto" style={{ alignSelf: 'flex-start' }}>
              Open {s.title.toLowerCase()} <Icon name="next" size={18} />
            </span>
          </a>
        ))}
      </div>
      <div className="tiny">
        Design reference only. Data is made up and lives in your browser. Nothing here is the
        production app.
      </div>
    </div>
  );
}
