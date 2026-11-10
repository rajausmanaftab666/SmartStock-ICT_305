import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool, types, type PoolClient, type QueryResultRow } from 'pg';
import { env } from './env';

/**
 * node-postgres hands back the wire format for a few types, which is not what
 * the rest of the application expects:
 *   NUMERIC -> string  (money would end up as "18.50" in JSON)
 *   INT8    -> string  (COUNT(*) would end up as "40")
 *   DATE    -> Date    (midnight local time, which shifts the calendar day)
 * Registering the parsers here means every query in the app gets the same
 * shapes without per-call casting.
 */
types.setTypeParser(types.builtins.NUMERIC, (value) => Number.parseFloat(value));
types.setTypeParser(types.builtins.INT8, (value) => Number.parseInt(value, 10));
types.setTypeParser(types.builtins.DATE, (value) => value); // keep 'YYYY-MM-DD'

/**
 * TLS settings, derived from DATABASE_SSL.
 *
 * `undefined` means "no TLS", which is what node-postgres wants for a plain
 * local connection — it is not the same as `false`.
 */
function sslConfig(): { rejectUnauthorized: boolean; ca?: string } | undefined {
  switch (env.DATABASE_SSL) {
    case 'true': {
      // With a CA certificate supplied we can verify properly. Supabase signs
      // with its own authority, which Node does not trust by default, so
      // without this the connection fails with "self-signed certificate in
      // certificate chain".
      if (env.DATABASE_CA_CERT) {
        const path = resolve(__dirname, '../..', env.DATABASE_CA_CERT);
        try {
          return { rejectUnauthorized: true, ca: readFileSync(path, 'utf8') };
        } catch {
          throw new Error(
            `DATABASE_CA_CERT is set but the file could not be read: ${path}\n` +
              'Download it from Supabase: Settings -> Database -> SSL Configuration.'
          );
        }
      }
      return { rejectUnauthorized: true };
    }
    case 'no-verify':
      // Encrypted, but the server's identity is not checked. Traffic is still
      // protected from eavesdropping; it is not protected against something
      // impersonating the database. Acceptable for development, and the
      // fallback when no CA certificate is to hand.
      return { rejectUnauthorized: false };
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// ORIGINAL LOCAL-ONLY POOL — kept for reference.
//
//   export const pool = new Pool({
//     connectionString: env.DATABASE_URL,
//     max: 10,
//     idleTimeoutMillis: 30_000,
//   });
//
// The version below is a superset of it. With DATABASE_SSL unset (or "false")
// and DATABASE_MAX_CONNECTIONS unset, it behaves identically to the above, so
// nothing about local development changes. The extra settings only come into
// play against a hosted database such as Supabase.
// ---------------------------------------------------------------------------

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: sslConfig(),
  max: env.DATABASE_MAX_CONNECTIONS,
  idleTimeoutMillis: 30_000,
  // Without this a wrong host or a blocked port hangs the request instead of
  // failing. Irrelevant on localhost, essential over the internet.
  connectionTimeoutMillis: 15_000,
});

/** Host and database name only — never the password. Used in start-up logs. */
export function describeConnection(): string {
  try {
    const url = new URL(env.DATABASE_URL);
    const database = url.pathname.replace(/^\//, '') || 'postgres';
    const tls = env.DATABASE_SSL === 'false' ? 'no TLS' : `TLS ${env.DATABASE_SSL}`;
    return `${database} at ${url.hostname}:${url.port || '5432'} (${tls})`;
  } catch {
    return 'an unparseable DATABASE_URL';
  }
}

pool.on('error', (err) => {
  // An idle client failing is not tied to a request; log it rather than crash.
  console.error('[db] idle client error', err);
});

/** Anything that can run a query: the pool, or a client inside a transaction. */
export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[]
  ): Promise<{ rows: R[]; rowCount: number | null }>;
}

export async function query<R extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: readonly unknown[]
): Promise<R[]> {
  const result = await pool.query<R>(text, values as unknown[]);
  return result.rows;
}

export async function queryOne<R extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: readonly unknown[]
): Promise<R | null> {
  const rows = await query<R>(text, values);
  return rows[0] ?? null;
}

/**
 * Runs `fn` inside a single database transaction, committing on success and
 * rolling back on any thrown error. BR1 depends on this: a stock balance
 * update and its ledger row must land together or not at all.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
