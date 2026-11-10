/**
 * Small helpers for reading PostgreSQL error codes without leaking `pg`
 * specifics into the service layer.
 */

interface PgError {
  code?: string;
  constraint?: string;
}

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';
const CHECK_VIOLATION = '23514';

function asPgError(error: unknown): PgError | null {
  return error && typeof error === 'object' && 'code' in error ? (error as PgError) : null;
}

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const pg = asPgError(error);
  if (pg?.code !== UNIQUE_VIOLATION) return false;
  return constraint ? pg.constraint === constraint : true;
}

export function isForeignKeyViolation(error: unknown): boolean {
  return asPgError(error)?.code === FOREIGN_KEY_VIOLATION;
}

export function isCheckViolation(error: unknown, constraint?: string): boolean {
  const pg = asPgError(error);
  if (pg?.code !== CHECK_VIOLATION) return false;
  return constraint ? pg.constraint === constraint : true;
}
