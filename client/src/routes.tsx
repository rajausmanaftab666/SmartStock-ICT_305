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
import { SupplierFormPage } from './pages/Suppliers/SupplierFormPage';
import { SupplierListPage } from './pages/Suppliers/SupplierListPage';

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

          {/* Suppliers are administrator-owned (§7.3). */}
          <Route
            path="/suppliers"
            element={
              <RequireRole roles={[...CATALOGUE_READERS]}>
                <SupplierListPage />
              </RequireRole>
            }
          />
          <Route
            path="/suppliers/new"
            element={
              <RequireRole roles={['admin']}>
                <SupplierFormPage />
              </RequireRole>
            }
          />
          <Route
            path="/suppliers/:id/edit"
            element={
              <RequireRole roles={['admin']}>
                <SupplierFormPage />
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
