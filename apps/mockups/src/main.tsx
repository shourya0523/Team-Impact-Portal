import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './shared/styles.css';
import { WorldProvider, useWorld } from './shared/store';
import Landing from './Landing';
import MobileApp from './app/MobileApp';
import Portal from './portal/Portal';
import Staff from './staff/Staff';

type Route = '' | 'app' | 'portal' | 'staff';
const read = (): Route => (location.hash.replace(/^#\/?/, '').split('/')[0] as Route) || '';

function MockBar({ route }: { route: Route }) {
  const { reset } = useWorld();
  const links: [Route, string][] = [
    ['', 'Overview'],
    ['app', 'Mobile app'],
    ['portal', 'Recruiter portal'],
    ['staff', 'Staff portal'],
  ];
  return (
    <div className="mockbar" role="navigation" aria-label="Mockups">
      <img
        src="/logo.png"
        alt=""
        style={{ width: 20, background: '#fff', borderRadius: 4, padding: 2 }}
      />
      {links.map(([r, l]) => (
        <a key={r} href={'#/' + r} aria-current={route === r ? 'page' : undefined}>
          {l}
        </a>
      ))}
      <span className="sp" />
      <button
        onClick={() => {
          if (confirmReset()) {
            reset();
            location.reload();
          }
        }}
      >
        Reset demo data
      </button>
    </div>
  );
}
const confirmReset = () => window.confirm('Reset all demo data?');

function Root() {
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const f = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return (
    <>
      <MockBar route={route} />
      {route === 'app' ? (
        <MobileApp key="app" />
      ) : route === 'portal' ? (
        <Portal key="portal" />
      ) : route === 'staff' ? (
        <Staff key="staff" />
      ) : (
        <Landing />
      )}
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorldProvider>
      <Root />
    </WorldProvider>
  </StrictMode>,
);
