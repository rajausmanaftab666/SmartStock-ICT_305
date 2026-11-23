import { afterAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { closePool, query } from '../src/config/db';
import { ACCOUNTS, app, signIn } from './helpers';

afterAll(async () => {
  await closePool();
});

describe('GET /api/categories', () => {
  it('needs a session', async () => {
    expect((await supertest(app).get('/api/categories')).status).toBe(401);
  });

  it('returns the five seeded categories with their product counts', async () => {
    const agent = await signIn(ACCOUNTS.staff);
    const { status, body } = await agent.get('/api/categories');

    expect(status).toBe(200);
    expect(body.categories).toHaveLength(5);
    const total = body.categories.reduce(
      (sum: number, c: { product_count: number }) => sum + c.product_count,
      0
    );
    expect(total).toBe(40);
  });

  it('is closed to supplier users', async () => {
    const agent = await signIn(ACCOUNTS.supplierHarbourline);
    expect((await agent.get('/api/categories')).status).toBe(403);
  });
});

describe('category writes are administrator-only (§6.4)', () => {
  it('refuses create, update and delete for staff and manager', async () => {
    for (const email of [ACCOUNTS.staff, ACCOUNTS.manager]) {
      const agent = await signIn(email);
      expect((await agent.post('/api/categories').send({ name: 'Nope' })).status).toBe(403);
      expect((await agent.put('/api/categories/1').send({ name: 'Nope' })).status).toBe(403);
      expect((await agent.delete('/api/categories/1')).status).toBe(403);
    }
  });

  it('lets an administrator create, rename and delete an unused category', async () => {
    const agent = await signIn(ACCOUNTS.admin);

    const created = await agent
      .post('/api/categories')
      .send({ name: 'Test Category', description: 'Temporary' });
    expect(created.status).toBe(201);
    expect(created.body.category.product_count).toBe(0);
    const id = created.body.category.id;

    const renamed = await agent
      .put(`/api/categories/${id}`)
      .send({ name: 'Test Category Renamed', description: '' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.category.name).toBe('Test Category Renamed');
    expect(renamed.body.category.description).toBeNull();

    expect((await agent.delete(`/api/categories/${id}`)).status).toBe(204);
    expect((await agent.delete(`/api/categories/${id}`)).status).toBe(404);
  });

  it('refuses a duplicate name (§9)', async () => {
    const agent = await signIn(ACCOUNTS.admin);
    const response = await agent.post('/api/categories').send({ name: 'Beverages' });

    expect(response.status).toBe(400);
    expect(response.body.fields.name).toBeTruthy();
  });

  it('requires a name', async () => {
    const agent = await signIn(ACCOUNTS.admin);
    const response = await agent.post('/api/categories').send({ name: '   ' });
    expect(response.status).toBe(400);
    expect(response.body.fields.name).toBeTruthy();
  });
});

describe('BR12 — a category in use cannot be deleted', () => {
  it('returns 409 and names the blocking product count, leaving the row intact', async () => {
    const agent = await signIn(ACCOUNTS.admin);

    const list = await agent.get('/api/categories');
    const beverages = list.body.categories.find(
      (c: { name: string }) => c.name === 'Beverages'
    );
    expect(beverages.product_count).toBe(8);

    const response = await agent.delete(`/api/categories/${beverages.id}`);
    expect(response.status).toBe(409);
    expect(response.body.error).toContain('Beverages');
    expect(response.body.error).toContain('8 products');

    // Nothing was removed.
    const stillThere = await query('SELECT id FROM categories WHERE id = $1', [beverages.id]);
    expect(stillThere).toHaveLength(1);
  });
});
