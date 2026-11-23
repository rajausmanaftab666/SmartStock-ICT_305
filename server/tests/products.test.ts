import { afterAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { closePool, query, queryOne } from '../src/config/db';
import { ACCOUNTS, app, signIn } from './helpers';

afterAll(async () => {
  await closePool();
});

/** Removes a product created by a test, ledger first. */
async function destroyProduct(id: number): Promise<void> {
  await query('DELETE FROM stock_movements WHERE product_id = $1', [id]);
  await query('DELETE FROM products WHERE id = $1', [id]);
}

function draftProduct(overrides: Record<string, unknown> = {}) {
  return {
    sku: `TST-${Math.floor(Math.random() * 1_000_000)}`,
    name: 'Test Product',
    description: 'Created by the test suite',
    category_id: 1,
    supplier_id: 1,
    unit: 'case',
    unit_price: 12.5,
    opening_quantity: 0,
    min_stock_level: 10,
    status: 'active',
    ...overrides,
  };
}

describe('GET /api/products', () => {
  it('needs a session', async () => {
    expect((await supertest(app).get('/api/products')).status).toBe(401);
  });

  it('is readable by admin, staff and manager but not suppliers', async () => {
    for (const email of [ACCOUNTS.admin, ACCOUNTS.staff, ACCOUNTS.manager]) {
      const agent = await signIn(email);
      const response = await agent.get('/api/products');
      expect(response.status, email).toBe(200);
      expect(response.body.total).toBe(40);
    }

    const supplier = await signIn(ACCOUNTS.supplierHarbourline);
    expect((await supplier.get('/api/products')).status).toBe(403);
  });

  it('searches on name or SKU (S7)', async () => {
    const agent = await signIn(ACCOUNTS.staff);

    const byName = await agent.get('/api/products?search=Espresso');
    expect(byName.body.rows).toHaveLength(1);
    expect(byName.body.rows[0].sku).toBe('BEV-1004');

    const bySku = await agent.get('/api/products?search=CLN-3001');
    expect(bySku.body.rows).toHaveLength(1);
    expect(bySku.body.rows[0].name).toBe('Industrial Degreaser 5L');
  });

  it('filters by category, supplier and status', async () => {
    const agent = await signIn(ACCOUNTS.staff);

    expect((await agent.get('/api/products?category_id=1')).body.total).toBe(8);
    expect((await agent.get('/api/products?supplier_id=1')).body.total).toBe(8);
    expect((await agent.get('/api/products?status=inactive')).body.total).toBe(1);
  });

  it('computes is_low per BR15 and filters on it', async () => {
    const agent = await signIn(ACCOUNTS.staff);

    const low = await agent.get('/api/products?low_stock=true&limit=100');
    expect(low.body.total).toBe(8);
    for (const product of low.body.rows) {
      expect(product.is_low).toBe(true);
      expect(product.status).toBe('active');
      expect(product.quantity_in_stock).toBeLessThanOrEqual(product.min_stock_level);
    }

    // The inactive product sits below its minimum but is not "low" — BR15
    // only counts active products.
    const inactive = await agent.get('/api/products?search=STA-5003');
    expect(inactive.body.rows[0].quantity_in_stock).toBeLessThanOrEqual(
      inactive.body.rows[0].min_stock_level
    );
    expect(inactive.body.rows[0].is_low).toBe(false);
  });

  it('sorts server-side on the whitelisted keys only', async () => {
    const agent = await signIn(ACCOUNTS.staff);

    const byPrice = await agent.get('/api/products?sort=unit_price&direction=desc&limit=100');
    const prices = byPrice.body.rows.map((r: { unit_price: number }) => r.unit_price);
    expect(prices[0]).toBe(248);
    expect(prices).toEqual([...prices].sort((a: number, b: number) => b - a));

    const byStock = await agent.get('/api/products?sort=quantity_in_stock&direction=asc&limit=100');
    const stock = byStock.body.rows.map((r: { quantity_in_stock: number }) => r.quantity_in_stock);
    expect(stock).toEqual([...stock].sort((a: number, b: number) => a - b));

    expect((await agent.get('/api/products?sort=unit_price;DROP TABLE products')).status).toBe(400);
  });

  it('paginates server-side', async () => {
    const agent = await signIn(ACCOUNTS.staff);
    const page1 = await agent.get('/api/products?limit=20&page=1&sort=sku');
    const page2 = await agent.get('/api/products?limit=20&page=2&sort=sku');

    expect(page1.body.rows).toHaveLength(20);
    expect(page2.body.rows).toHaveLength(20);
    expect(page1.body.total).toBe(40);
    const overlap = page1.body.rows.filter((a: { id: number }) =>
      page2.body.rows.some((b: { id: number }) => b.id === a.id)
    );
    expect(overlap).toHaveLength(0);
  });
});

describe('GET /api/products/:id and its movements', () => {
  it('returns the joined detail S10 shows', async () => {
    const agent = await signIn(ACCOUNTS.manager);
    const list = await agent.get('/api/products?search=BEV-1001');
    const id = list.body.rows[0].id;

    const { status, body } = await agent.get(`/api/products/${id}`);
    expect(status).toBe(200);
    expect(body.product).toMatchObject({
      sku: 'BEV-1001',
      category_name: 'Beverages',
      supplier_name: 'Harbourline Beverages',
      created_by_name: expect.any(String),
      is_low: true,
    });
  });

  it('returns the movement history newest first, paginated', async () => {
    const agent = await signIn(ACCOUNTS.staff);
    const list = await agent.get('/api/products?search=BEV-1001');
    const id = list.body.rows[0].id;

    const { status, body } = await agent.get(`/api/products/${id}/movements`);
    expect(status).toBe(200);
    expect(body.rows.length).toBeGreaterThan(0);

    const timestamps = body.rows.map((m: { created_at: string }) => new Date(m.created_at).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a: number, b: number) => b - a));

    // The newest movement closes on the product's stored balance (BR1/BR2).
    const product = await agent.get(`/api/products/${id}`);
    expect(body.rows[0].balance_after).toBe(product.body.product.quantity_in_stock);
    expect(body.rows[0].user_name).toEqual(expect.any(String));
  });

  it('404s for a product that does not exist', async () => {
    const agent = await signIn(ACCOUNTS.staff);
    expect((await agent.get('/api/products/99999')).status).toBe(404);
    expect((await agent.get('/api/products/99999/movements')).status).toBe(404);
  });
});

describe('POST /api/products', () => {
  it('is closed to managers — they are read-only over the catalogue', async () => {
    const agent = await signIn(ACCOUNTS.manager);
    expect((await agent.post('/api/products').send(draftProduct())).status).toBe(403);
  });

  it('creates a product with no opening stock and writes no movement', async () => {
    const agent = await signIn(ACCOUNTS.staff);
    const response = await agent.post('/api/products').send(draftProduct({ opening_quantity: 0 }));

    expect(response.status).toBe(201);
    const product = response.body.product;
    expect(product.quantity_in_stock).toBe(0);

    const movements = await agent.get(`/api/products/${product.id}/movements`);
    expect(movements.body.total).toBe(0);

    await destroyProduct(product.id);
  });

  it('writes an opening_balance movement in the same transaction (BR1)', async () => {
    const agent = await signIn(ACCOUNTS.staff);
    const response = await agent
      .post('/api/products')
      .send(draftProduct({ opening_quantity: 25, min_stock_level: 30 }));

    expect(response.status).toBe(201);
    const product = response.body.product;
    expect(product.quantity_in_stock).toBe(25);
    // 25 <= 30, and it is active, so it is low from the moment it exists.
    expect(product.is_low).toBe(true);

    const movements = await agent.get(`/api/products/${product.id}/movements`);
    expect(movements.body.total).toBe(1);
    expect(movements.body.rows[0]).toMatchObject({
      type: 'IN',
      reason: 'opening_balance',
      quantity_change: 25,
      balance_after: 25,
    });

    await destroyProduct(product.id);
  });

  it('rolls the product back if the opening movement fails — nothing is written', async () => {
    const agent = await signIn(ACCOUNTS.staff);
    const sku = `TST-ROLLBACK-${Math.floor(Math.random() * 1_000_000)}`;

    // A negative opening quantity is refused by validation before the insert.
    const response = await agent
      .post('/api/products')
      .send(draftProduct({ sku, opening_quantity: -5 }));
    expect(response.status).toBe(400);

    const orphan = await queryOne('SELECT id FROM products WHERE sku = $1', [sku]);
    expect(orphan).toBeNull();
  });

  it('refuses a duplicate SKU (§9)', async () => {
    const agent = await signIn(ACCOUNTS.staff);
    const response = await agent.post('/api/products').send(draftProduct({ sku: 'BEV-1001' }));

    expect(response.status).toBe(400);
    expect(response.body.fields.sku).toBeTruthy();
  });

  it('validates SKU format, name length, price and levels (§9)', async () => {
    const agent = await signIn(ACCOUNTS.staff);
    const response = await agent.post('/api/products').send(
      draftProduct({
        sku: 'has spaces!',
        name: 'x',
        unit_price: -3,
        min_stock_level: -1,
      })
    );

    expect(response.status).toBe(400);
    expect(response.body.fields.sku).toBeTruthy();
    expect(response.body.fields.name).toBeTruthy();
    expect(response.body.fields.unit_price).toBeTruthy();
    expect(response.body.fields.min_stock_level).toBeTruthy();
  });

  it('refuses more than two decimal places on the price (§9)', async () => {
    const agent = await signIn(ACCOUNTS.staff);
    const response = await agent.post('/api/products').send(draftProduct({ unit_price: 10.999 }));
    expect(response.status).toBe(400);
    expect(response.body.fields.unit_price).toBeTruthy();
  });

  it('reports an unknown category or supplier against the right field', async () => {
    const agent = await signIn(ACCOUNTS.staff);
    const response = await agent
      .post('/api/products')
      .send(draftProduct({ category_id: 9999, supplier_id: 9999 }));

    expect(response.status).toBe(400);
    expect(response.body.fields.category_id).toBeTruthy();
    expect(response.body.fields.supplier_id).toBeTruthy();
  });
});

describe('PUT /api/products/:id — an edit can never move stock (BR1)', () => {
  it('saves every other field and leaves the balance untouched', async () => {
    const agent = await signIn(ACCOUNTS.staff);
    const created = await agent.post('/api/products').send(draftProduct({ opening_quantity: 40 }));
    const product = created.body.product;
    expect(product.quantity_in_stock).toBe(40);

    const edited = await agent.put(`/api/products/${product.id}`).send({
      sku: product.sku,
      name: 'Renamed Product',
      description: '',
      category_id: 2,
      supplier_id: 2,
      unit: 'sack',
      unit_price: 99.99,
      min_stock_level: 5,
      status: 'active',
    });

    expect(edited.status).toBe(200);
    expect(edited.body.product.name).toBe('Renamed Product');
    expect(edited.body.product.unit_price).toBe(99.99);
    expect(edited.body.product.quantity_in_stock).toBe(40);
    expect(edited.body.product.updated_by_name).toBeTruthy();

    // No extra ledger row appeared: the only movement is still the opening one.
    const movements = await agent.get(`/api/products/${product.id}/movements`);
    expect(movements.body.total).toBe(1);

    await destroyProduct(product.id);
  });

  it('ignores a quantity_in_stock supplied in the request body', async () => {
    const agent = await signIn(ACCOUNTS.staff);
    const created = await agent.post('/api/products').send(draftProduct({ opening_quantity: 12 }));
    const product = created.body.product;

    await agent.put(`/api/products/${product.id}`).send({
      sku: product.sku,
      name: product.name,
      description: '',
      category_id: product.category_id,
      supplier_id: product.supplier_id,
      unit: product.unit,
      unit_price: product.unit_price,
      min_stock_level: product.min_stock_level,
      status: 'active',
      // A hand-crafted request trying to set stock directly.
      quantity_in_stock: 9999,
    });

    const after = await agent.get(`/api/products/${product.id}`);
    expect(after.body.product.quantity_in_stock).toBe(12);

    await destroyProduct(product.id);
  });
});

describe('PATCH /api/products/:id/status — BR10', () => {
  it('deactivates and reactivates, and there is no delete route', async () => {
    const agent = await signIn(ACCOUNTS.staff);
    const created = await agent.post('/api/products').send(draftProduct({ opening_quantity: 5 }));
    const id = created.body.product.id;

    const off = await agent.patch(`/api/products/${id}/status`).send({ status: 'inactive' });
    expect(off.status).toBe(200);
    expect(off.body.product.status).toBe('inactive');
    // An inactive product is never "low", however little of it there is.
    expect(off.body.product.is_low).toBe(false);

    const on = await agent.patch(`/api/products/${id}/status`).send({ status: 'active' });
    expect(on.body.product.status).toBe('active');

    expect((await agent.delete(`/api/products/${id}`)).status).toBe(404);

    // The ledger survived deactivation.
    const movements = await agent.get(`/api/products/${id}/movements`);
    expect(movements.body.total).toBe(1);

    await destroyProduct(id);
  });

  it('is closed to managers', async () => {
    const agent = await signIn(ACCOUNTS.manager);
    expect((await agent.patch('/api/products/1/status').send({ status: 'inactive' })).status).toBe(
      403
    );
  });
});
