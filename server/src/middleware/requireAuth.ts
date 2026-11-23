import type { RequestHandler } from 'express';
import { unauthorized } from '../types/errors';
import * as authService from '../modules/auth/auth.service';

/**
 * Revalidates the session against the database on every request (§5.1 step 5).
 *
 * The session stores only a user id. The role, supplier link and active status
 * are re-read each time, so deactivating a user or changing their role takes
 * effect on their very next request instead of whenever their cookie expires.
 * Nothing downstream ever trusts a role held in the cookie.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const userId = req.session?.userId;
  if (!userId) {
    next(unauthorized());
    return;
  }

  try {
    const user = await authService.loadActiveUser(userId);
    if (!user) {
      // The account was deleted or deactivated while signed in.
      req.session.destroy(() => undefined);
      next(unauthorized('Your account is no longer active. Please sign in again.'));
      return;
    }

    req.user = user;
    // Keep the session's copy in step with the database.
    req.session.role = user.role;
    req.session.supplierId = user.supplier_id;
    next();
  } catch (error) {
    next(error);
  }
};
