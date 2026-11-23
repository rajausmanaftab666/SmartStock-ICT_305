import { useNavigate } from 'react-router-dom';
import { ROLE_LABEL } from '@shared';
import { useAuth } from '../../hooks/useAuth';
import { landingPathFor } from '../../navigation';
import { Icon } from '../../components/Icon';

/** Shown when an authenticated user reaches a screen their role cannot use. */
export function ForbiddenPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="card card--pad empty" role="alert">
      <span className="empty__glyph">
        <Icon name="lock" size={20} />
      </span>
      <span className="empty__title">You do not have access to this page</span>
      <span className="empty__text">
        {user
          ? `Your account is signed in as ${user.name} (${ROLE_LABEL[user.role]}), and that role cannot open this screen. If you believe this is wrong, ask an administrator to review your role.`
          : 'Sign in to continue.'}
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
  );
}
