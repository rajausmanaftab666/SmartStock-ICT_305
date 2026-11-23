import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppSettings, AuthUser, Role } from '@shared';
import { authApi } from '../api/auth';
import { settingsApi } from '../api/settings';

interface AuthContextValue {
  user: AuthUser | null;
  settings: AppSettings | null;
  /** True only while the very first identity check is in flight. */
  isLoading: boolean;
  is: (...roles: Role[]) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const FALLBACK_SETTINGS: AppSettings = {
  company_name: 'SmartStock',
  currency_symbol: '$',
  default_min_stock_level: 10,
  po_number_prefix: 'PO-',
  low_stock_banner_enabled: true,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // The session is the server's to decide. This query is the client's only
  // opinion about who is signed in, and every guard reads it.
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    retry: false,
    staleTime: 30_000,
  });

  const user = meQuery.data ?? null;

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
    // Only meaningful once signed in, and rarely changes.
    enabled: user !== null,
    staleTime: 5 * 60_000,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
  }, [queryClient]);

  const signOut = useCallback(async () => {
    await authApi.logout();

    // Nothing from the old session should still be in flight.
    await queryClient.cancelQueries();

    // The guards read this query, so it has to be *told* the user is gone.
    //
    // clear() and removeQueries() are not enough on their own: they drop the
    // cache entry, but a mounted observer keeps its last successful result in
    // memory. The guard would go on seeing the signed-out user and leave them
    // sitting on the dashboard, while every other query 401s and the screen
    // empties out. Writing null is what actually flips it, and it happens
    // synchronously so the redirect is immediate.
    queryClient.setQueryData(['auth', 'me'], null);

    // Everything else is dropped so the next user never sees the last one's
    // data — but the auth query itself is left in place, holding that null.
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      settings: settingsQuery.data ?? (user ? FALLBACK_SETTINGS : null),
      isLoading: meQuery.isLoading,
      is: (...roles: Role[]) => (user ? roles.includes(user.role) : false),
      refresh,
      signOut,
    }),
    [user, settingsQuery.data, meQuery.isLoading, refresh, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}

/** The signed-in user, for screens that are already behind an auth guard. */
export function useCurrentUser(): AuthUser {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser used outside an authenticated route');
  return user;
}

export function useSettings(): AppSettings {
  const { settings } = useAuth();
  return settings ?? FALLBACK_SETTINGS;
}
