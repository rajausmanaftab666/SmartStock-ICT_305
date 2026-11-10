import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pool, closePool } from '../config/db';

/**
 * Drops and recreates every SmartStock object from schema.sql.
 * Destructive by design — `npm run db:reset` is how the demo database is
 * rebuilt from nothing before a screenshot run.
 */
async function main(): Promise<void> {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  const target = new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');

  console.log(`[db:reset] applying schema.sql to "${target}"…`);
  await pool.query(sql);
  console.log('[db:reset] schema rebuilt. Run `npm run seed` to load demo data.');
}

main()
  .catch((error) => {
    console.error('[db:reset] failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
