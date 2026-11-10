import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import type { RequestHandler } from 'express';
import { pool } from './db';
import { env } from './env';

const PgStore = connectPgSimple(session);

/**
 * Sessions are stored in PostgreSQL, not in memory: restarting the API does not
 * sign everyone out, and the cookie itself holds only an opaque identifier.
 *
 * `sameSite: 'lax'` and `httpOnly` are the specified defaults. `secure` is left
 * off in development because the dev server is plain HTTP; in production the
 * cookie is HTTPS-only.
 */
export function sessionMiddleware(): RequestHandler {
  return session({
    name: 'smartstock.sid',
    secret: env.SESSION_SECRET,
    store: new PgStore({
      pool,
      tableName: 'session',
      // The table is part of schema.sql; creating it here as well means a
      // developer who runs the API before db:reset still gets a working store.
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 15,
    }),
    resave: false,
    saveUninitialized: false,
    // Each request pushes the expiry out, so an active user is not signed out
    // mid-task.
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 8,
      path: '/',
    },
  });
}
