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
  admin: [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/users', label: 'Users', icon: 'users' },
    { path: '/suppliers', label: 'Suppliers', icon: 'truck' },
    { path: '/products', label: 'Products', icon: 'box' },
    { path: '/purchase-orders', label: 'Purchase orders', icon: 'doc' },
    { path: '/alerts', label: 'Alerts', icon: 'alert', showsLowStockCount: true },
    { path: '/settings', label: 'Settings', icon: 'gear' },
  ],
  staff: [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/products', label: 'Products', icon: 'box' },
    { path: '/stock/record', label: 'Record stock', icon: 'plus' },
    { path: '/purchase-orders', label: 'Purchase orders', icon: 'doc' },
    { path: '/suppliers', label: 'Suppliers', icon: 'truck' },
    { path: '/alerts', label: 'Alerts', icon: 'alert', showsLowStockCount: true },
  ],
  manager: [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/purchase-orders', label: 'Purchase orders', icon: 'doc' },
    { path: '/products', label: 'Products', icon: 'box' },
    { path: '/suppliers', label: 'Suppliers', icon: 'truck' },
  ],
  supplier: [{ path: '/supplier/orders', label: 'My orders', icon: 'doc' }],
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
