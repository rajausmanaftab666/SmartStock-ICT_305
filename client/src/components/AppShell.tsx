import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ROLE_LABEL } from '@shared';
import { useAuth, useCurrentUser, useSettings } from '../hooks/useAuth';
import { useLowStockCount } from '../hooks/useLowStock';
import { useToast } from '../hooks/useToast';
import { NAV_BY_ROLE, lowStockPathFor } from '../navigation';
import { Icon } from './Icon';
import { PageTitleProvider, usePageTitle } from './PageHeader';

/**
 * The frame every screen but the login page sits in: a fixed sidebar, a sticky
 * topbar and a padded main column.
 *
 * The prototype's "Prototype · view as" role switcher is deliberately absent —
 * roles now come from a real session, and a client-side switcher would
 * contradict the guards.
 */
export function AppShell() {
  return (
    <PageTitleProvider>
      <div className="shell">
        <Sidebar />
        <div className="shell__body">
          <Topbar />
          <main className="shell__main">
            <Outlet />
          </main>
        </div>
      </div>
    </PageTitleProvider>
  );
}

function Sidebar() {
  const user = useCurrentUser();
  const settings = useSettings();
  const lowStockCount = useLowStockCount();
  const items = NAV_BY_ROLE[user.role];

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__logo" aria-hidden="true">
          S
        </span>
        <span className="sidebar__names">
          <span className="sidebar__product">SmartStock</span>
          <span className="sidebar__company">{settings.company_name}</span>
        </span>
      </div>

      <nav className="sidebar__nav" aria-label="Main">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
            title={item.label}
          >
            <Icon name={item.icon} className="nav-item__icon" />
            <span className="nav-item__label">{item.label}</span>
            {item.showsLowStockCount && lowStockCount ? (
              <span className="nav-item__count">{lowStockCount}</span>
            ) : null}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

function Topbar() {
  const user = useCurrentUser();
  const settings = useSettings();
  const lowStockCount = useLowStockCount();
  const pageTitle = usePageTitle();
  const { signOut } = useAuth();
  const { error } = useToast();
  const navigate = useNavigate();

  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('');

  async function handleSignOut() {
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch {
      error('Could not sign out. Please try again.');
    }
  }

  return (
    <header className="topbar">
      <div className="topbar__crumbs">
        <span>{settings.company_name}</span>
        <span className="topbar__sep">/</span>
        <span className="topbar__page">{pageTitle}</span>
      </div>

      <button
        type="button"
        className="topbar__bell"
        title="Low stock alerts"
        onClick={() => navigate(lowStockPathFor(user.role))}
      >
        <Icon name="bell" />
        {lowStockCount ? <span className="topbar__bell-count">{lowStockCount}</span> : null}
        <span className="visually-hidden">
          Low stock alerts{lowStockCount ? `, ${lowStockCount} products below minimum` : ''}
        </span>
      </button>

      <div className="topbar__user">
        <span className="topbar__avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="topbar__identity">
          <span className="topbar__name">{user.name}</span>
          <span className="topbar__role">{ROLE_LABEL[user.role]}</span>
        </span>
        <button type="button" className="btn btn--secondary btn--xs" onClick={() => navigate('/profile')}>
          Profile
        </button>
        <button type="button" className="btn btn--secondary btn--xs" onClick={handleSignOut}>
          Log out
        </button>
      </div>
    </header>
  );
}
