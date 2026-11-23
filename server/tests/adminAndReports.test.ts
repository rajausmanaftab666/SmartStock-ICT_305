import { afterAll, describe, expect, it } from 'vitest';
import { closePool, query } from '../src/config/db';
import { ACCOUNTS, DEMO_PASSWORD, signIn } from './helpers';

afterAll(async () => {
  await closePool();
});

describe('user management (§6.2)', () => {
  it('is administrator-only', async () => {
    for (const email of [ACCOUNTS.staff, ACCOUNTS.manager, ACCOUNTS.supplierHarbourline]) {
      const agent = await signIn(email);
      expect((await agent.get('/api/users')).status, email).toBe(403);
    }
  });

  it('lists, searches and filters the seven accounts', async () => {
    const agent = await signIn(ACCOUNTS.admin);

    const all = await agent.get('/api/users?limit=50');
    expect(all.body.total).toBe(7);

    const suppliers = await agent.get('/api/users?role=supplier');
    expect(suppliers.body.total).toBe(3);
    for (const user of suppliers.body.rows) expect(user.supplier_name).toBeTruthy();

    const inactive = await agent.get('/api/users?status=inactive');
    expect(inactive.body.total).toBe(1);
    expect(inactive.body.rows[0].email).toBe(ACCOUNTS.supplierInactive);

    const search = await agent.get('/api/users?search=hana');
    expect(search.body.rows[0].email).toBe(ACCOUNTS.staff2);
  });

  it('BR18 — a supplier user needs a company, and nobody else may have one', async () => {
    const agent = await signIn(ACCOUNTS.admin);

    const supplierWithout = await agent.post('/api/users').send({
      name: 'Bad Supplier',
      email: `bad-${Date.now()}@example.com`,
      role: 'supplier',
      supplier_id: null,
      status: 'active',
      password: 'password123',
      confirm_password: 'password123',
    });
    expect(supplierWithout.status).toBe(400);
    expect(supplierWithout.body.fields.supplier_id).toBeTruthy();

    const staffWith = await agent.post('/api/users').send({
      name: 'Bad Staff',
      email: `bad2-${Date.now()}@example.com`,
      role: 'staff',
      supplier_id: 1,
      status: 'active',
      password: 'password123',
      confirm_password: 'password123',
    });
    expect(staffWith.status).toBe(400);
    expect(staffWith.body.fields.supplier_id).toBeTruthy();
  });

  it('creates, edits, resets a password and deactivates — never deletes (BR10)', async () => {
    const agent = await signIn(ACCOUNTS.admin);
    const email = `temp-${Date.now()}@smartstock.io`;

    const created = await agent.post('/api/users').send({
      name: 'Temporary Staff',
      email,
      role: 'staff',
      supplier_id: null,
      status: 'active',
      password: 'password123',
      confirm_password: 'password123',
    });
    expect(created.status).toBe(201);
    const id = created.body.user.id;

    // The new account can sign in immediately.
    await signIn(email, 'password123');

    const edited = await agent
      .put(`/api/users/${id}`)
      .send({ name: 'Renamed Staff', email, role: 'manager', supplier_id: null, status: 'active' });
    expect(edited.status).toBe(200);
    expect(edited.body.user.role).toBe('manager');

    const reset = await agent
      .post(`/api/users/${id}/reset-password`)
      .send({ new_password: 'brand-new-password' });
    expect(reset.status).toBe(200);
    await signIn(email, 'brand-new-password');

    const off = await agent.patch(`/api/users/${id}/status`).send({ status: 'inactive' });
    expect(off.body.user.status).toBe('inactive');

    // BR19 — a deactivated account can no longer sign in.
    await expect(signIn(email, 'brand-new-password')).rejects.toThrow();

    expect((await agent.delete(`/api/users/${id}`)).status).toBe(404);
    await query('DELETE FROM users WHERE id = $1', [id]);
  });

  it('refuses a duplicate email and a mismatched confirmation (§9)', async () => {
    const agent = await signIn(ACCOUNTS.admin);

    const duplicate = await agent.post('/api/users').send({
      name: 'Clash',
      email: ACCOUNTS.admin,
      role: 'staff',
      supplier_id: null,
      status: 'active',
      password: 'password123',
      confirm_password: 'password123',
    });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.fields.email).toBeTruthy();

    const mismatch = await agent.post('/api/users').send({
      name: 'Mismatch',
      email: `mismatch-${Date.now()}@example.com`,
      role: 'staff',
      supplier_id: null,
      status: 'active',
      password: 'password123',
      confirm_password: 'something-else',
    });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.fields.confirm_password).toBeTruthy();
  });

  it('will not let an administrator deactivate their own account (§6.2)', async () => {
    const agent = await signIn(ACCOUNTS.admin);
    const me = await agent.get('/api/auth/me');
    const id = me.body.user.id;

    const response = await agent.patch(`/api/users/${id}/status`).send({ status: 'inactive' });
    expect(response.status).toBe(403);
    expect(response.body.error).toContain('your own account');

    // Still able to sign in.
    await signIn(ACCOUNTS.admin, DEMO_PASSWORD);
  });
});
