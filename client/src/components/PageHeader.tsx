import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";

/**
 * The topbar breadcrumb has to show the current page's title, but the title is
 * often data — a product name, a PO number — that only the page itself knows.
 * PageHeader publishes it here and the shell reads it.
 */
interface PageTitleContextValue {
  title: string;
  setTitle: (title: string) => void;
}

const PageTitleContext = createContext<PageTitleContextValue | null>(null);

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("");
  const value = useMemo(() => ({ title, setTitle }), [title]);
  return (
    <PageTitleContext.Provider value={value}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitle(): string {
  return useContext(PageTitleContext)?.title ?? "";
}

export interface PageAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Renders the "← Back to X" link above the title. */
  back?: { label: string; to: string };
  actions?: PageAction[];
}

export function PageHeader({
  title,
  subtitle,
  back,
  actions = [],
}: PageHeaderProps) {
  const context = useContext(PageTitleContext);
  const setTitle = context?.setTitle;

  useEffect(() => {
    setTitle?.(title);
    document.title = `${title} · SmartStock`;
  }, [title, setTitle]);

  return (
    <div className="page-header">
      <div className="page-header__text">
        {back && (
          <Link className="page-header__back" to={back.to}>
            ← Back to {back.label}
          </Link>
        )}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions.length > 0 && (
        <div className="btn-group">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`btn btn--${action.variant ?? "secondary"}`}
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
