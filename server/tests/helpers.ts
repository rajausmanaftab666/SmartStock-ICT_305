import supertest from 'supertest';
import { createApp } from '../src/app';

/**
 * Tests run against the seeded development database. They must therefore be
 * read-only, or undo whatever they change — `npm run seed` restores it either
 * way.
 */
export const app = createApp();

export const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? 'demo1234';

export const ACCOUNTS = {
  admin: 'admin@smartstock.io',
  staff: 'staff@smartstock.io',
  staff2: 'hana@smartstock.io',
  manager: 'manager@smartstock.io',
  supplierHarbourline: 'dana@harbourline.com.au',
  supplierKettle: 'marcus@kettlegrain.com',
  supplierInactive: 'tobias@cartonworks.com',
} as const;

/**
 * Signs in and returns an agent that carries the session cookie, so subsequent
 * requests are authenticated exactly as a browser would be.
 */
export async function signIn(email: string, password = DEMO_PASSWORD) {
  const agent = supertest.agent(app);
  const response = await agent.post('/api/auth/login').send({ email, password });
  if (response.status !== 200) {
    throw new Error(`Sign-in for ${email} failed with ${response.status}: ${response.text}`);
  }
  return agent;
}
