import { afterAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { closePool, query } from '../src/config/db';
import { ACCOUNTS, app, signIn } from './helpers';

afterAll(async () => {
  await closePool();
});

describe('GET /api/suppliers', () => {
  it('needs a session', async () => {
    expect((await supertest(app).get('/api/suppliers')).status).toBe(401);
  });

  it('is readable by admin, staff and manager (§7.3)', async () => {
    for (const email of [ACCOUNTS.admin, ACCOUNTS.staff, ACCOUNTS.manager]) {
      const agent = await signIn(email);
      const response = await agent.get('/api/suppliers');
      expect(response.status, `${email} should be able to read suppliers`).toBe(200);
      expect(response.body.total).toBe(6);
    }
  });

  it('is closed to supplier users — they see no other companies', async () => {
    const agent = await signIn(ACCOUNTS.supplierHarbourline);
    expect((await agent.get('/api/suppliers')).status).toBe(403);
  });

  it('returns the product and open-order counts S13 shows', async () => {
    const agent = await signIn(ACCOUNTS.staff);
    const { body } = await agent.get('/api/suppliers?search=Harbourline');

    expect(body.rows).toHaveLength(1);
    const harbourline = body.rows[0];
    expect(harbourline.product_count).toBe(8);
    // Open = not received, cancelled or rejected.
    expect(harbourline.open_order_count).toBeGreaterThan(0);
  });

  it('filters by status and searches name, contact and email', async () => {
    const agent = await signIn(ACCOUNTS.admin);

    const active = await agent.get('/api/suppliers?status=active');
    expect(active.body.total).toBe(5);

    const inactive = await agent.get('/api/suppliers?status=inactive');
    expect(inactive.body.total).toBe(1);
    expect(inactive.body.rows[0].name).toBe('Northbay Dry Goods');

    const byContact = await agent.get('/api/suppliers?search=Priya');
    expect(byContact.body.rows[0].name).toBe('Meridian Office Stationery');

    const byEmail = await agent.get('/api/suppliers?search=kettlegrain');
    expect(byEmail.body.rows[0].name).toBe('Kettle & Grain Wholesale');
  });

  it('paginates and sorts server-side', async () => {
    const agent = await signIn(ACCOUNTS.admin);

    const firstPage = await agent.get('/api/suppliers?limit=2&page=1&sort=name&direction=asc');
    expect(firstPage.body.rows).toHaveLength(2);
    expect(firstPage.body.total).toBe(6);
    expect(firstPage.body.page).toBe(1);

    const secondPage = await agent.get('/api/suppliers?limit=2&page=2&sort=name&direction=asc');
    expect(secondPage.body.rows).toHaveLength(2);
    expect(secondPage.body.rows[0].id).not.toBe(firstPage.body.rows[0].id);

    const descending = await agent.get('/api/suppliers?sort=lead_time_days&direction=desc');
    const leadTimes = descending.body.rows.map((r: { lead_time_days: number }) => r.lead_time_days);
    expect(leadTimes).toEqual([...leadTimes].sort((a: number, b: number) => b - a));
  });

  it('rejects an unknown sort key rather than interpolating it', async () => {
    const agent = await signIn(ACCOUNTS.admin);
    const response = await agent.get('/api/suppliers?sort=name;DROP TABLE suppliers');
    expect(response.status).toBe(400);
  });
});

describe('GET /api/suppliers/:id', () => {
  it('includes the products and recent orders panels (S14)', async () => {
    const agent = await signIn(ACCOUNTS.manager);
    const list = await agent.get('/api/suppliers?search=Harbourline');
    const id = list.body.rows[0].id;

    const { status, body } = await agent.get(`/api/suppliers/${id}`);
    expect(status).toBe(200);
    expect(body.supplier.products).toHaveLength(8);
    expect(body.supplier.recent_orders.length).toBeGreaterThan(0);
    expect(body.supplier.recent_orders.length).toBeLessThanOrEqual(5);
    expect(body.supplier.products[0]).toMatchObject({
      sku: expect.any(String),
      quantity_in_stock: expect.any(Number),
    });
  });

  it('404s for a supplier that does not exist', async () => {
    const agent = await signIn(ACCOUNTS.admin);
    expect((await agent.get('/api/suppliers/99999')).status).toBe(404);
  });
});

describe('supplier writes are administrator-only (§7.3)', () => {
  const draft = {
    name: 'Test Supplier Co',
    contact_person: 'Test Contact',
    email: 'test@example.com',
    phone: '+61 8 0000 0000',
    address: '1 Test St',
    lead_time_days: 9,
    status: 'active',
  };

  it('refuses create, update and status changes for staff and manager', async () => {
    for (const email of [ACCOUNTS.staff, ACCOUNTS.manager]) {
      const agent = await signIn(email);
      expect((await agent.post('/api/suppliers').send(draft)).status).toBe(403);
      expect((await agent.put('/api/suppliers/1').send(draft)).status).toBe(403);
      expect((await agent.patch('/api/suppliers/1/status').send({ status: 'inactive' })).status).toBe(
        403
      );
    }
  });

  it('lets an administrator create, edit and deactivate — never delete (BR10)', async () => {
    const agent = await signIn(ACCOUNTS.admin);

    const created = await agent.post('/api/suppliers').send(draft);
    expect(created.status).toBe(201);
    const id = created.body.supplier.id;
    expect(created.body.supplier.lead_time_days).toBe(9);
    expect(created.body.supplier.product_count).toBe(0);

    const edited = await agent
      .put(`/api/suppliers/${id}`)
      .send({ ...draft, name: 'Test Supplier Renamed', lead_time_days: 21 });
    expect(edited.status).toBe(200);
    expect(edited.body.supplier.name).toBe('Test Supplier Renamed');
    expect(edited.body.supplier.lead_time_days).toBe(21);

    const deactivated = await agent.patch(`/api/suppliers/${id}/status`).send({ status: 'inactive' });
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.supplier.status).toBe('inactive');

    const reactivated = await agent.patch(`/api/suppliers/${id}/status`).send({ status: 'active' });
    expect(reactivated.body.supplier.status).toBe('active');

    // There is no delete route at all — deactivation is the only removal.
    expect((await agent.delete(`/api/suppliers/${id}`)).status).toBe(404);

    await query('DELETE FROM suppliers WHERE id = $1', [id]);
  });

  it('validates against §9: name length, email format, lead time range', async () => {
    const agent = await signIn(ACCOUNTS.admin);

    const response = await agent.post('/api/suppliers').send({
      ...draft,
      name: 'x',
      email: 'not-an-email',
      lead_time_days: 400,
    });

    expect(response.status).toBe(400);
    expect(response.body.fields.name).toBeTruthy();
    expect(response.body.fields.email).toBeTruthy();
    expect(response.body.fields.lead_time_days).toBeTruthy();
  });

  it('accepts a supplier with no email or phone at all', async () => {
    const agent = await signIn(ACCOUNTS.admin);
    const created = await agent.post('/api/suppliers').send({
      name: 'Minimal Supplier',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      lead_time_days: 0,
      status: 'active',
    });

    expect(created.status).toBe(201);
    expect(created.body.supplier.email).toBeNull();
    await query('DELETE FROM suppliers WHERE id = $1', [created.body.supplier.id]);
  });
});
