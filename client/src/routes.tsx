import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { RequireAuth, RequireRole } from './components/guards';
import { useAuth } from './hooks/useAuth';
import { landingPathFor } from './navigation';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { ForbiddenPage } from './pages/Forbidden/ForbiddenPage';
import { LoginPage } from './pages/Login/LoginPage';
import { NotFoundPage } from './pages/NotFound/NotFoundPage';
import { ProfilePage } from './pages/Profile/ProfilePage';

/** Sends "/" to whichever screen this role starts on. */
function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? landingPathFor(user.role) : '/login'} replace />;
}

const CATALOGUE_READERS = ['admin', 'staff', 'manager'] as const;

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<HomeRedirect />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/403" element={<ForbiddenPage />} />

          <Route
            path="/dashboard"
            element={
              <RequireRole roles={[...CATALOGUE_READERS]}>
                <DashboardPage />
              </RequireRole>
            }
          />

          {/* Feature routes are added here, one pull request at a time. */}

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
