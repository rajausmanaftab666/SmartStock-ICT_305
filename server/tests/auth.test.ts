import { afterAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { closePool } from '../src/config/db';
import { ACCOUNTS, DEMO_PASSWORD, app, signIn } from './helpers';

afterAll(async () => {
  await closePool();
});

describe('POST /api/auth/login', () => {
  it('signs a valid user in and says where to send them (§5.1)', async () => {
    const response = await supertest(app)
      .post('/api/auth/login')
      .send({ email: ACCOUNTS.staff, password: DEMO_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('staff');
    expect(response.body.user).not.toHaveProperty('password_hash');
    expect(response.body.redirect_to).toBe('/dashboard');
    expect(response.headers['set-cookie']?.[0]).toContain('smartstock.sid');
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(response.headers['set-cookie']?.[0]).toContain('SameSite=Lax');
  });

  it('sends supplier users to their own portal', async () => {
    const response = await supertest(app)
      .post('/api/auth/login')
      .send({ email: ACCOUNTS.supplierHarbourline, password: DEMO_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('supplier');
    expect(response.body.user.supplier_id).not.toBeNull();
    expect(response.body.redirect_to).toBe('/supplier/orders');
  });

  it('refuses a deactivated user even with the right password (BR19)', async () => {
    const response = await supertest(app)
      .post('/api/auth/login')
      .send({ email: ACCOUNTS.supplierInactive, password: DEMO_PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid email or password.');
  });

  it('gives the same generic message for a wrong password and an unknown email', async () => {
    const wrongPassword = await supertest(app)
      .post('/api/auth/login')
      .send({ email: ACCOUNTS.admin, password: 'not-the-password' });
    const unknownEmail = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@smartstock.io', password: DEMO_PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error).toBe('Invalid email or password.');
    expect(unknownEmail.body.error).toBe(wrongPassword.body.error);
  });

  it('validates the request body and reports per-field errors', async () => {
    const response = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: '' });

    expect(response.status).toBe(400);
    expect(response.body.fields).toHaveProperty('email');
    expect(response.body.fields).toHaveProperty('password');
  });
});

describe('session guards', () => {
  it('returns 401 to a logged-out request (§5.1 step 5)', async () => {
    const response = await supertest(app).get('/api/auth/me');
    expect(response.status).toBe(401);
  });

  it('returns the current user to a signed-in request', async () => {
    const agent = await signIn(ACCOUNTS.manager);
    const response = await agent.get('/api/auth/me');

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(ACCOUNTS.manager);
    expect(response.body.user.role).toBe('manager');
  });

  it('stops accepting the cookie after logout', async () => {
    const agent = await signIn(ACCOUNTS.admin);
    expect((await agent.get('/api/auth/me')).status).toBe(200);

    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(204);

    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('does not leak the role from the cookie — it is re-read per request', async () => {
    const agent = await signIn(ACCOUNTS.staff);
    const first = await agent.get('/api/auth/me');
    const second = await agent.get('/api/auth/me');
    expect(first.body.user.role).toBe('staff');
    expect(second.body.user.role).toBe('staff');
  });
});

describe('POST /api/auth/change-password', () => {
  it('rejects a wrong current password against the right field', async () => {
    const agent = await signIn(ACCOUNTS.admin);
    const response = await agent.post('/api/auth/change-password').send({
      current_password: 'wrong-password',
      new_password: 'a-new-password',
      confirm_password: 'a-new-password',
    });

    expect(response.status).toBe(400);
    expect(response.body.fields?.current_password).toBeTruthy();
  });

  it('requires the confirmation to match and the password to be 8+ characters (§9)', async () => {
    const agent = await signIn(ACCOUNTS.admin);

    const mismatch = await agent.post('/api/auth/change-password').send({
      current_password: DEMO_PASSWORD,
      new_password: 'long-enough-password',
      confirm_password: 'something-else',
    });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.fields?.confirm_password).toBeTruthy();

    const tooShort = await agent.post('/api/auth/change-password').send({
      current_password: DEMO_PASSWORD,
      new_password: 'short',
      confirm_password: 'short',
    });
    expect(tooShort.status).toBe(400);
    expect(tooShort.body.fields?.new_password).toBeTruthy();
  });

  it('changes the password and can change it back', async () => {
    const agent = await signIn(ACCOUNTS.staff2);
    const temporary = 'temporary-password-1';

    const change = await agent.post('/api/auth/change-password').send({
      current_password: DEMO_PASSWORD,
      new_password: temporary,
      confirm_password: temporary,
    });
    expect(change.status).toBe(200);

    // The old password no longer works, the new one does.
    const oldFails = await supertest(app)
      .post('/api/auth/login')
      .send({ email: ACCOUNTS.staff2, password: DEMO_PASSWORD });
    expect(oldFails.status).toBe(401);

    const newAgent = await signIn(ACCOUNTS.staff2, temporary);

    // Restore, so the seeded demo credentials keep working.
    const restore = await newAgent.post('/api/auth/change-password').send({
      current_password: temporary,
      new_password: DEMO_PASSWORD,
      confirm_password: DEMO_PASSWORD,
    });
    expect(restore.status).toBe(200);
  });
});

describe('GET /api/settings', () => {
  it('needs a session', async () => {
    expect((await supertest(app).get('/api/settings')).status).toBe(401);
  });

  it('returns typed settings to any signed-in role (§3.2)', async () => {
    const agent = await signIn(ACCOUNTS.supplierKettle);
    const response = await agent.get('/api/settings');

    expect(response.status).toBe(200);
    expect(response.body.settings).toMatchObject({
      company_name: expect.any(String),
      currency_symbol: expect.any(String),
      default_min_stock_level: expect.any(Number),
      po_number_prefix: expect.any(String),
      low_stock_banner_enabled: expect.any(Boolean),
    });
  });
});

describe('unknown API routes', () => {
  it('returns a JSON 404 rather than HTML', async () => {
    const response = await supertest(app).get('/api/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Not found.');
  });
});
