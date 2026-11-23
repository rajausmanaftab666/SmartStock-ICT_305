import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { AlertsPage } from './pages/Alerts/AlertsPage';
import { RequireAuth, RequireRole } from './components/guards';
import { useAuth } from './hooks/useAuth';
import { landingPathFor } from './navigation';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { ForbiddenPage } from './pages/Forbidden/ForbiddenPage';
import { LoginPage } from './pages/Login/LoginPage';
import { NotFoundPage } from './pages/NotFound/NotFoundPage';
import { ProductDetailPage } from './pages/Products/ProductDetailPage';
import { ProductFormPage } from './pages/Products/ProductFormPage';
import { ProductListPage } from './pages/Products/ProductListPage';
import { ProfilePage } from './pages/Profile/ProfilePage';
import { SettingsPage } from './pages/Settings/SettingsPage';
import { RecordMovementPage } from './pages/Stock/RecordMovementPage';
import { SupplierFormPage } from './pages/Suppliers/SupplierFormPage';
import { SupplierListPage } from './pages/Suppliers/SupplierListPage';
import { UserFormPage } from './pages/Users/UserFormPage';
import { UserListPage } from './pages/Users/UserListPage';

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

          {/* Catalogue — managers read, admin and staff maintain. */}
          <Route
            path="/products"
            element={
              <RequireRole roles={[...CATALOGUE_READERS]}>
                <ProductListPage />
              </RequireRole>
            }
          />
          <Route
            path="/products/new"
            element={
              <RequireRole roles={['admin', 'staff']}>
                <ProductFormPage />
              </RequireRole>
            }
          />
          <Route
            path="/products/:id"
            element={
              <RequireRole roles={[...CATALOGUE_READERS]}>
                <ProductDetailPage />
              </RequireRole>
            }
          />
          <Route
            path="/products/:id/edit"
            element={
              <RequireRole roles={['admin', 'staff']}>
                <ProductFormPage />
              </RequireRole>
            }
          />

          {/* Recording stock is inventory staff's job alone. */}
          <Route
            path="/stock/record"
            element={
              <RequireRole roles={['staff']}>
                <RecordMovementPage />
              </RequireRole>
            }
          />

          {/* Managers reach low stock through their report instead (§7.2). */}
          <Route
            path="/alerts"
            element={
              <RequireRole roles={['admin', 'staff']}>
                <AlertsPage />
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

          {/* User administration and settings are the administrator's alone. */}
          <Route
            path="/users"
            element={
              <RequireRole roles={['admin']}>
                <UserListPage />
              </RequireRole>
            }
          />
          <Route
            path="/users/new"
            element={
              <RequireRole roles={['admin']}>
                <UserFormPage />
              </RequireRole>
            }
          />
          <Route
            path="/users/:id/edit"
            element={
              <RequireRole roles={['admin']}>
                <UserFormPage />
              </RequireRole>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireRole roles={['admin']}>
                <SettingsPage />
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
