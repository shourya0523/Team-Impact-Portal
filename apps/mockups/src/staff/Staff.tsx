import { useEffect, useRef } from 'react';
import { useNav, useWorld } from '../shared/store';
import { Avatar, Logo, useToast } from '../shared/ui';
import { STAFF_NAME, StaffProvider, type Nav, type Screen } from './state';
import { CreateTeam, TeamDetail, Teams } from './screens/Teams';
import { AddCompany, Companies, CompanyDetail } from './screens/Companies';
import { Moderation, TicketScreen } from './screens/Moderation';
import { Groups } from './screens/Groups';
import { Announce } from './screens/Announce';
import { Analytics } from './screens/Analytics';
import { Alumni } from './screens/Alumni';

/** Which sidenav section each screen belongs to. */
const SECTION: Record<Screen, Screen> = {
  teams: 'teams',
  createTeam: 'teams',
  team: 'teams',
  companies: 'companies',
  addCompany: 'companies',
  company: 'companies',
  moderation: 'moderation',
  ticket: 'moderation',
  groups: 'groups',
  announce: 'announce',
  analytics: 'analytics',
  alumni: 'alumni',
};
const ITEMS: [Screen, string][] = [
  ['teams', 'Teams'],
  ['companies', 'Companies'],
  ['moderation', 'Moderation'],
  ['groups', 'Groups'],
  ['announce', 'Announcements'],
  ['analytics', 'Analytics'],
  ['alumni', 'Alumni cards'],
];

function SideNav({ nav }: { nav: Nav }) {
  const { world } = useWorld();
  const open = world.tickets.filter((t) => t.status === 'open').length;
  const active = SECTION[nav.screen];
  return (
    <nav className="sidenav" aria-label="Staff">
      <div className="row g10" style={{ marginBottom: 18, minHeight: 44, flexBasis: '100%' }}>
        <Logo size={30} boxed />
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.12em' }}>STAFF</div>
      </div>
      {ITEMS.map(([id, label]) => (
        <button
          key={id}
          aria-current={active === id ? 'page' : undefined}
          onClick={() => nav.reset(id)}
        >
          <span>{label}</span>
          {id === 'moderation' && open > 0 && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                background: 'var(--red)',
                color: '#fff',
                borderRadius: 999,
                padding: '2px 8px',
                marginLeft: 8,
              }}
            >
              {open}
              <span className="sr-only"> open</span>
            </span>
          )}
        </button>
      ))}
      <div
        className="row g10 mt-auto"
        style={{
          paddingTop: 18,
          borderTop: '1px solid rgba(255,255,255,.18)',
          marginTop: 'auto',
          flexBasis: '100%',
        }}
      >
        <Avatar name={STAFF_NAME} color="var(--red)" size={36} />
        <div className="stack">
          <div style={{ fontSize: 14, fontWeight: 600 }}>{STAFF_NAME}</div>
          <div style={{ fontSize: 12, color: 'var(--on-navy)' }}>Team IMPACT staff</div>
        </div>
      </div>
    </nav>
  );
}

function Body({ screen }: { screen: Screen }) {
  switch (screen) {
    case 'teams':
      return <Teams />;
    case 'createTeam':
      return <CreateTeam />;
    case 'team':
      return <TeamDetail />;
    case 'companies':
      return <Companies />;
    case 'addCompany':
      return <AddCompany />;
    case 'company':
      return <CompanyDetail />;
    case 'moderation':
      return <Moderation />;
    case 'ticket':
      return <TicketScreen />;
    case 'groups':
      return <Groups />;
    case 'announce':
      return <Announce />;
    case 'analytics':
      return <Analytics />;
    case 'alumni':
      return <Alumni />;
  }
}

export default function Staff() {
  const nav = useNav<Screen>('teams');
  const [toast, show] = useToast(true);
  const main = useRef<HTMLElement>(null);
  const key = nav.screen + JSON.stringify(nav.params);

  // Move focus to the new page and scroll to top on every screen change.
  useEffect(() => {
    window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [key]);

  return (
    <StaffProvider nav={nav} toast={show}>
      <div className="staff-shell">
        <SideNav nav={nav} />
        <main
          ref={main}
          tabIndex={-1}
          className="staff-main screen"
          key={key}
          style={{ outline: 'none' }}
        >
          <Body screen={nav.screen} />
        </main>
      </div>
      {toast}
    </StaffProvider>
  );
}
