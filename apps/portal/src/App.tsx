import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import type { Role } from '@team-impact/contracts';
import { Layout } from './Layout';
import { AthletePage } from './pages/recruiter/Athlete';
import { ListPage } from './pages/recruiter/List';
import { ListsPage } from './pages/recruiter/Lists';
import { SearchPage } from './pages/recruiter/Search';
import { SignInPage } from './pages/SignIn';
import { AnnouncementsPage } from './pages/staff/Announcements';
import { CollegesPage } from './pages/staff/Colleges';
import { CommunitiesPage } from './pages/staff/Communities';
import { CompaniesPage } from './pages/staff/Companies';
import { ModerationPage } from './pages/staff/Moderation';
import { TeamsPage } from './pages/staff/Teams';
import { homeFor, isPortalRole, SessionProvider, useSession } from './session';

/**
 * Signed out → sign-in; a role outside `allow` → its own home. The API refuses those calls too;
 * this only keeps people off pages that would fail.
 */
const Guard = ({ allow, children }: { allow: Role[]; children: ReactNode }) => {
  const { me } = useSession();
  const location = useLocation();
  if (me === undefined) return null;
  if (!me || !isPortalRole(me.role)) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }
  if (!allow.includes(me.role)) return <Navigate to={homeFor(me.role)} replace />;
  return children;
};

const Home = () => {
  const { me } = useSession();
  if (me === undefined) return null;
  return <Navigate to={me && isPortalRole(me.role) ? homeFor(me.role) : '/sign-in'} replace />;
};

export const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/sign-in" element={<SignInPage />} />
    <Route
      element={
        <Guard allow={['recruiter', 'staff']}>
          <Layout />
        </Guard>
      }
    >
      <Route
        path="/search"
        element={
          <Guard allow={['recruiter']}>
            <SearchPage />
          </Guard>
        }
      />
      <Route
        path="/athletes/:id"
        element={
          <Guard allow={['recruiter']}>
            <AthletePage />
          </Guard>
        }
      />
      <Route
        path="/lists"
        element={
          <Guard allow={['recruiter']}>
            <ListsPage />
          </Guard>
        }
      />
      <Route
        path="/lists/:id"
        element={
          <Guard allow={['recruiter']}>
            <ListPage />
          </Guard>
        }
      />
      <Route
        path="/staff/teams"
        element={
          <Guard allow={['staff']}>
            <TeamsPage />
          </Guard>
        }
      />
      <Route
        path="/staff/colleges"
        element={
          <Guard allow={['staff']}>
            <CollegesPage />
          </Guard>
        }
      />
      <Route
        path="/staff/announcements"
        element={
          <Guard allow={['staff']}>
            <AnnouncementsPage />
          </Guard>
        }
      />
      <Route
        path="/staff/companies"
        element={
          <Guard allow={['staff']}>
            <CompaniesPage />
          </Guard>
        }
      />
      <Route
        path="/staff/moderation"
        element={
          <Guard allow={['staff']}>
            <ModerationPage />
          </Guard>
        }
      />
      <Route
        path="/staff/communities"
        element={
          <Guard allow={['staff']}>
            <CommunitiesPage />
          </Guard>
        }
      />
    </Route>
    <Route path="*" element={<Home />} />
  </Routes>
);

/** Portal for recruiters and Team Impact staff (PRD §7, §9). */
export const App = () => (
  <SessionProvider>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </SessionProvider>
);
