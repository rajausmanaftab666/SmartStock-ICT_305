import { useNavigate } from 'react-router-dom';
import { useAuth, useSettings } from '../hooks/useAuth';
import { useLowStockCount } from '../hooks/useLowStock';
import { lowStockPathFor } from '../navigation';

/**
 * §5.8 — shown on a dashboard when anything is below its minimum and the
 * `low_stock_banner_enabled` setting is on. Nothing is stored: the count is
 * the same computed BR15 query the badges use.
 */
export function LowStockBanner() {
  const { user } = useAuth();
  const settings = useSettings();
  const count = useLowStockCount();
  const navigate = useNavigate();

  if (!user || !count || !settings.low_stock_banner_enabled) return null;

  return (
    <div className="banner" role="status">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#dc6803"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M12 4 3 20h18L12 4Zm0 6v5m0 3v.01" />
      </svg>
      <span className="banner__text">
        {count} {count === 1 ? 'product is' : 'products are'} at or below their minimum stock level.
      </span>
      <button
        type="button"
        className="banner__action"
        onClick={() => navigate(lowStockPathFor(user.role))}
      >
        {user.role === 'manager' ? 'Open low stock report' : 'View alerts'}
      </button>
    </div>
  );
}
