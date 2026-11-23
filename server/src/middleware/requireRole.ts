import type { RequestHandler } from 'express';
import type { Role } from '@shared';
import { forbidden, unauthorized } from '../types/errors';

/**
 * Route-level authorisation. Always mounted after requireAuth, so req.user is
 * the freshly re-read database row rather than anything the client supplied.
 *
 * This guards *routes*. Row-level scoping for supplier users is a separate
 * concern and is applied in the SQL itself (BR11).
 */
export function requireRole(...allowed: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (!allowed.includes(req.user.role)) {
      next(forbidden('Your role does not have access to this.'));
      return;
    }
    next();
  };
}
