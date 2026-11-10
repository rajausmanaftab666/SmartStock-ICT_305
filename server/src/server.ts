import { createApp } from './app';
import { closePool, describeConnection, pool } from './config/db';
import { env } from './config/env';

async function start(): Promise<void> {
  // Fail loudly at boot rather than on the first request if the database is
  // unreachable or has not been created yet.
  try {
    await pool.query('SELECT 1');
    // Printed so it is obvious at a glance whether this process is pointed at
    // the local database or a hosted one.
    console.log(`[api] database: ${describeConnection()}`);
  } catch (error) {
    console.error(
      `[api] cannot reach ${describeConnection()}.\n` +
        '      Check DATABASE_URL and DATABASE_SSL in server/.env.\n' +
        '      Hosted databases (Supabase and similar) need DATABASE_SSL=true.'
    );
    throw error;
  }

  const server = createApp().listen(env.PORT, () => {
    console.log(`[api] SmartStock API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string) => {
    console.log(`\n[api] ${signal} received, shutting down…`);
    server.close(() => {
      void closePool().finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((error) => {
  console.error('[api] failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
});
