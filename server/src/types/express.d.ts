import type { AuthUser, Role } from '@shared';

/**
 * The session cookie carries nothing but an opaque id; this is what the server
 * keeps against it. `req.user` is the freshly re-read database row, attached by
 * requireAuth on every request — never trusted from the session alone.
 */
declare module 'express-session' {
  interface SessionData {
    userId: number;
    role: Role;
    supplierId: number | null;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
