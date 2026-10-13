// Mobile app mockup: phone frame, role-aware tab bar, in-app navigation and a demo persona switcher.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import './app.css';
import { useNav, useWorld } from '../shared/store';
import { Icon, useToast } from '../shared/ui';
import { PERSONAS, homeOf, personaOf, tabsFor, type PersonaId, type Screen } from './model';
import {
  AppProvider,
  initialLocal,
  newDraft,
  type AppCtx,
  type Draft,
  type Local,
  type Me,
} from './state';
import {
  Account,
  AlumniInvite,
  Details,
  FindTeam,
  Pending,
  RequestJoin,
  ScanQR,
  Signed,
  Terms,
  Under13,
  Verify,
  Welcome,
} from './screens/Onboarding';
import { Composer, Home, Notifications, PostDetail, Report } from './screens/Feed';
import {
  CreateEvent,
  CreateGroup,
  EventDetail,
  Events,
  GroupDetail,
  Groups,
} from './screens/Community';
import { AddCoach, ChildProfile, CoachQR, CoachTeam, EditTeam, Roster } from './screens/Team';
import { CardEditor, CardHistory, CardHome, CardReview, ExportCard, Upload } from './screens/Card';
import { AlumniBrowse, AlumniProfile, Me as MeScreen, Recruiting, Safety } from './screens/Me';
import { ListDetail, Lists, QuickReview, RecruiterCard } from './screens/Recruiter';

const SCREENS: Record<Screen, () => ReactNode> = {
  welcome: Welcome,
  account: Account,
  under13: Under13,
  details: Details,
  terms: Terms,
  find: FindTeam,
  request: RequestJoin,
  pending: Pending,
  scan: ScanQR,
  signed: Signed,
  verify: Verify,
  alumniInvite: AlumniInvite,
  home: Home,
  composer: Composer,
  post: PostDetail,
  report: Report,
  notifications: Notifications,
  events: Events,
  event: EventDetail,
  createEvent: CreateEvent,
  groups: Groups,
  group: GroupDetail,
  createGroup: CreateGroup,
  roster: Roster,
  child: ChildProfile,
  coachTeam: CoachTeam,
  coachQR: CoachQR,
  addCoach: AddCoach,
  editTeam: EditTeam,
  card: CardHome,
  upload: Upload,
  cardReview: CardReview,
  editor: CardEditor,
  export: ExportCard,
  history: CardHistory,
  me: MeScreen,
  recruiting: Recruiting,
  safety: Safety,
  alumni: AlumniBrowse,
  alumniProfile: AlumniProfile,
  quick: QuickReview,
  rcard: RecruiterCard,
  lists: Lists,
  list: ListDetail,
};

const TIPS: Record<PersonaId, string[]> = {
  new: [
    'Change the birth year: 2014 or later is blocked (a parent signs up), 2009–2013 can only join as a Teammate.',
    'Send a join request, then switch to Coach Rivera: it waits in Team. Or use “Prototype: coach approves”.',
    'Scan a QR code to skip the wait and get the Signed stamp.',
    'Try a gmail.com address as a Recruiter.',
  ],
  athlete: [
    'Card tab: flip and tilt the card, then turn off Open to recruiting. Maya disappears from the recruiter app and portal.',
    'Write a post that mentions Leo: it is forced team-only.',
    'Open a post, tap ··· and report it. A ticket appears in the staff portal.',
    'Card history → start a new season card to see resume upload and review.',
  ],
  parent: [
    'No Card tab and no composer. Rally, comment and RSVP from Home.',
    'Team → Leo to edit his profile (first name and age only).',
    'Roster shows athletes’ contact buttons, as each athlete allows.',
  ],
  teen: [
    'The composer only posts to the team.',
    'Team shows the roster with no phone numbers or emails.',
    'Teens can still read and comment on network posts.',
  ],
  coach: [
    'Team: approve or decline join requests. New sign-ups show up here.',
    'QR code: change how long it works, or revoke it.',
    'Remove a member (parents leave with their child).',
  ],
  alumni: [
    'Alumni tab: filter mentors and hiring alumni.',
    'Team posts, rosters and kids’ profiles stay hidden from alumni.',
    'Create a group, then open it from Home → Groups.',
  ],
  recruiter: [
    'Drag the card right to save, left to skip (or use the buttons).',
    'Change the save list or make a new one from the ▾ button.',
    'Saved athletes show up in the portal’s Lists too.',
    'Only athletes who published and opted in appear.',
  ],
};

export default function MobileApp() {
  const [persona, setPersona] = useState<PersonaId>('new');
  const [fresh, setFresh] = useState<{ name?: string; on: boolean }>({ on: false });
  const nav = useNav<Screen>('welcome');
  const [local, setLocalState] = useState<Local>(initialLocal);
  const [draft, setDraftState] = useState<Draft>(newDraft);
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  const [toastNode, toast] = useToast();
  const scroller = useRef<HTMLDivElement>(null);

  const key = nav.screen + JSON.stringify(nav.params);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [key]);

  const def = personaOf(persona);
  const name = fresh.on && fresh.name ? fresh.name : def.name;
  const me: Me = {
    persona,
    name,
    first: name.replace(/^Coach /, '').split(' ')[0] ?? name,
    roleLabel: def.roleLabel,
    teamId:
      fresh.on && (persona === 'athlete' || persona === 'parent' || persona === 'teen')
        ? draft.teamId
        : def.teamId,
    color: def.color,
    fresh: fresh.on,
  };

  const become: AppCtx['become'] = (p, opts = {}) => {
    setPersona(p);
    setFresh({ on: !!opts.fresh, name: opts.name });
    setLocalState((l) => ({
      ...l,
      hasCard: p === 'athlete' ? !opts.fresh : l.hasCard,
      cardDraft: null,
    }));
    if (p === 'new') {
      setDraftState(newDraft());
      nav.reset('welcome');
      return;
    }
    const home = homeOf(p);
    const s = opts.screen;
    if (!s || s === home) nav.reset(home);
    else if (tabsFor(p).some((t) => t.screen === s)) nav.reset(s);
    else {
      nav.reset(home);
      nav.go(s);
    }
  };

  const restart = () => {
    setLocalState(initialLocal());
    setDraftState(newDraft());
    setFresh({ on: false });
    nav.reset(homeOf(persona));
    toast('Restarted');
  };

  const ctx: AppCtx = {
    me,
    nav,
    toast,
    local,
    setLocal: setLocalState,
    draft,
    setDraft: setDraftState,
    become,
    layer,
  };
  const tabs = tabsFor(persona);
  const showTabs = tabs.some((t) => t.screen === nav.screen);
  const Current = SCREENS[nav.screen];

  return (
    <AppProvider value={ctx}>
      <div className="phone-stage">
        <div className="phone" aria-label="Team IMPACT app">
          <div className="phone-scroll" ref={scroller}>
            <div key={key} style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
              <Current />
            </div>
          </div>
          {showTabs && (
            <nav
              className="tabbar"
              aria-label="Main"
              style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
            >
              {tabs.map((t) => (
                <button
                  key={t.label}
                  aria-current={t.screen === nav.screen ? 'page' : undefined}
                  onClick={() => nav.reset(t.screen)}
                >
                  <Icon name={t.icon} size={24} />
                  {t.label}
                  {t.screen === 'coachTeam' && <PendingDot />}
                </button>
              ))}
            </nav>
          )}
          <div ref={setLayer} />
          {toastNode}
        </div>
        <aside className="phone-side" aria-label="Demo controls">
          <div className="stack g4">
            <div className="eyebrow red">Mobile app mockup</div>
            <h1 className="display d-36">Who are you?</h1>
          </div>
          <p className="small" style={{ margin: 0 }}>
            Switch person to see the app from their side. Everything they do lands in the shared
            demo data, so the recruiter and staff portals see it too.
          </p>
          <div className="side-persona" role="group" aria-label="Choose a person">
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                aria-pressed={persona === p.id && !fresh.on}
                onClick={() => become(p.id)}
              >
                <span
                  className="avatar"
                  style={{
                    width: 30,
                    height: 30,
                    fontSize: 12,
                    background: persona === p.id && !fresh.on ? '#fff' : p.color,
                    color: persona === p.id && !fresh.on ? 'var(--navy)' : '#fff',
                  }}
                >
                  {p.name
                    .replace(/^Coach /, 'C ')
                    .split(' ')
                    .map((x) => x[0])
                    .join('')
                    .slice(0, 2)}
                </span>
                <span className="stack grow">
                  <span>
                    {p.label} {p.who}
                  </span>
                </span>
              </button>
            ))}
            <button aria-pressed={persona === 'new' || fresh.on} onClick={() => become('new')}>
              <span className="avatar" style={{ width: 30, height: 30, background: 'var(--red)' }}>
                <Icon name="plus" size={16} />
              </span>
              <span className="stack grow">
                <span>New user: start sign-up</span>
                {fresh.on && <span className="s">Signed up as {me.name}</span>}
              </span>
            </button>
          </div>
          <div className="panel stack g8" style={{ padding: 14 }}>
            <div className="label">Things to try</div>
            <ul className="small stack g6" style={{ margin: 0, paddingLeft: 18 }}>
              {TIPS[persona].map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <button className="btn btn-outline" onClick={restart}>
            Restart
          </button>
          <div className="tiny">
            Restart clears this phone’s screens and settings. “Reset demo data” in the top bar
            resets the shared data too.
          </div>
        </aside>
      </div>
    </AppProvider>
  );
}

function PendingDot() {
  const { world } = useWorld();
  const n = world.joinRequests.filter((r) => r.teamId === 'ws' && r.status === 'pending').length;
  return n ? (
    <span className="dot" aria-label={`${n} waiting`}>
      {n}
    </span>
  ) : null;
}
