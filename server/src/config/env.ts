import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment is validated once, at import time. A missing or malformed value
 * fails the process immediately rather than surfacing as a confusing runtime
 * error deep inside a request.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required — copy .env.example to .env'),

  /**
   * TLS for the database connection.
   *
   *   false      local PostgreSQL — no encryption needed over localhost
   *   true       hosted PostgreSQL (Supabase, Neon, RDS) with certificate
   *              verification, which is what you want in production
   *   no-verify  same, but skips certificate checking. Only for the case where
   *              a provider serves a certificate Node does not trust; the
   *              connection is still encrypted, but not authenticated.
   *
   * Set here rather than as `?sslmode=require` in the URL on purpose: `pg`
   * currently reads `require` as the much stricter `verify-full`, and warns
   * that this changes in its next major version. An explicit option survives
   * that upgrade unchanged.
   */
  DATABASE_SSL: z.enum(['false', 'true', 'no-verify']).default('false'),

  /**
   * Path to the provider's CA certificate, relative to the server folder.
   *
   * Supabase signs its database certificates with its own authority, which
   * Node does not ship with — so plain `DATABASE_SSL=true` fails with
   * "self-signed certificate in certificate chain". Pointing this at their
   * downloaded certificate restores full verification: encrypted *and*
   * authenticated, rather than falling back to `no-verify`.
   *
   * Download it from: Supabase dashboard -> Settings -> Database ->
   * SSL Configuration -> Download certificate.
   */
  DATABASE_CA_CERT: z.string().optional(),

  /**
   * Pool size. Ten is comfortable against a local server. Hosted providers cap
   * connections far lower — check the limit for your plan before raising it.
   */
  DATABASE_MAX_CONNECTIONS: z.coerce.number().int().min(1).max(50).default(10),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  SEED_PASSWORD: z.string().min(8).default('demo1234'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detail = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${detail}`);
}

export const env = parsed.data;

export const isDev = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
