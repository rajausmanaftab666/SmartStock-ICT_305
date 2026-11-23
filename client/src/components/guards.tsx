import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@shared';
import { useAuth } from '../hooks/useAuth';
import { ForbiddenPage } from '../pages/Forbidden/ForbiddenPage';

/**
 * Client-side guards. They decide what to *render*; they are not the security
 * boundary. Every route they protect is independently guarded on the server,
 * which re-reads the session and the user's role on each request. Hiding a
 * screen here only spares the user a pointless 403.
 */

function FullPageLoading() {
  return (
    <div className="boot">
      <div className="boot__card">
        <div className="skeleton" style={{ width: 180 }} />
        <div className="skeleton" style={{ width: 240 }} />
        <div className="skeleton" style={{ width: 120 }} />
      </div>
    </div>
  );
}

/** Sends anyone without a session to the login screen. */
export function RequireAuth() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageLoading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Renders the 403 page in place when the signed-in role is not allowed here. */
export function RequireRole({ roles, children }: { roles: Role[]; children?: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <ForbiddenPage />;
  return <>{children ?? <Outlet />}</>;
}
