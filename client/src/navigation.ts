import type { Role } from '@shared';
import type { IconName } from './components/Icon';

export interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  /** Shows the low-stock count pill (BR15), wired up in stage 6. */
  showsLowStockCount?: boolean;
}

/**
 * Sidebar navigation, per role. Entries are added one pull request at a
 * time as each feature lands, so the menu only ever offers screens that
 * actually exist. The full set is reached at the end of Sprint 2.
 */
export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  admin:    [{ path: '/dashboard', label: 'Dashboard', icon: 'dashboard' }],
  staff:    [{ path: '/dashboard', label: 'Dashboard', icon: 'dashboard' }],
  manager:  [{ path: '/dashboard', label: 'Dashboard', icon: 'dashboard' }],
  supplier: [],
};

/** Where each role lands after signing in (§5.1 step 4). */
export function landingPathFor(role: Role): string {
  return role === 'supplier' ? '/supplier/orders' : '/dashboard';
}

/**
 * Where the low-stock bell and dashboard card point. Managers have no alerts
 * page, so they go to the low stock report instead.
 */
export function lowStockPathFor(role: Role): string {
  if (role === 'manager') return '/reports?type=low-stock';
  if (role === 'supplier') return '/supplier/orders';
  return '/alerts';
}
