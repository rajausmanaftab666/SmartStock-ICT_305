import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { landingPathFor } from '../../navigation';
import { PageHeader } from '../../components/PageHeader';

export function NotFoundPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <PageHeader title="Page not found" subtitle="That address does not match any screen." />
      <div className="card card--pad empty">
        <span className="empty__glyph">—</span>
        <span className="empty__title">Nothing here</span>
        <span className="empty__text">
          The link may be out of date, or the record may have been removed.
        </span>
        <div className="btn-group" style={{ marginTop: 'var(--s-2)' }}>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => navigate(user ? landingPathFor(user.role) : '/login')}
          >
            Back to my dashboard
          </button>
        </div>
      </div>
    </>
  );
}
