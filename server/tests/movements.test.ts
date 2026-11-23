import { afterAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { closePool, query, queryOne } from '../src/config/db';
import { ACCOUNTS, app, signIn } from './helpers';

afterAll(async () => {
  await closePool();
});

/** A scratch product so tests never disturb the seeded demo data. */
async function makeProduct(quantity: number, min = 5) {
  const agent = await signIn(ACCOUNTS.staff);
  const created = await agent.post('/api/products').send({
    sku: `MOV-${Math.floor(Math.random() * 1_000_000)}`,
    name: 'Movement Test Product',
    description: '',
    category_id: 1,
    supplier_id: 1,
    unit: 'case',
    unit_price: 10,
    opening_quantity: quantity,
    min_stock_level: min,
    status: 'active',
  });
  return { agent, product: created.body.product };
}

async function destroyProduct(id: number) {
  await query('DELETE FROM stock_movements WHERE product_id = $1', [id]);
  await query('DELETE FROM products WHERE id = $1', [id]);
}

describe('POST /api/stock-movements', () => {
  it('is staff-only — administrators and managers do not move stock', async () => {
    for (const email of [ACCOUNTS.admin, ACCOUNTS.manager]) {
      const agent = await signIn(email);
      const response = await agent
        .post('/api/stock-movements')
        .send({ product_id: 1, type: 'OUT', reason: 'sale_dispatch', quantity: 1 });
      expect(response.status, email).toBe(403);
    }
  });

  it('records an OUT movement and updates the balance in one go (BR1, BR2)', async () => {
    const { agent, product } = await makeProduct(50);

    const response = await agent.post('/api/stock-movements').send({
      product_id: product.id,
      type: 'OUT',
      reason: 'sale_dispatch',
      quantity: 12,
      reference: 'SO-9001',
    });

    expect(response.status).toBe(201);
    expect(response.body.previous_balance).toBe(50);
    expect(response.body.quantity_change).toBe(-12);
    expect(response.body.balance_after).toBe(38);
    expect(response.body.product.quantity_in_stock).toBe(38);

    const movements = await agent.get(`/api/products/${product.id}/movements`);
    expect(movements.body.rows[0]).toMatchObject({
      type: 'OUT',
      reason: 'sale_dispatch',
      quantity_change: -12,
      balance_after: 38,
      reference: 'SO-9001',
    });

    await destroyProduct(product.id);
  });

  it('records an IN movement', async () => {
    const { agent, product } = await makeProduct(10);
    const response = await agent.post('/api/stock-movements').send({
      product_id: product.id,
      type: 'IN',
      reason: 'customer_return',
      quantity: 5,
    });

    expect(response.status).toBe(201);
    expect(response.body.balance_after).toBe(15);
    await destroyProduct(product.id);
  });
});

describe('BR3 — a movement may never drive stock below zero', () => {
  it('rejects the movement and writes nothing at all', async () => {
    const { agent, product } = await makeProduct(8);

    const before = await agent.get(`/api/products/${product.id}/movements`);
    expect(before.body.total).toBe(1); // just the opening balance

    const response = await agent.post('/api/stock-movements').send({
      product_id: product.id,
      type: 'OUT',
      reason: 'sale_dispatch',
      quantity: 9,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('below zero');
    expect(response.body.fields.quantity).toBeTruthy();

    // The transaction rolled back: balance untouched, no ledger row added.
    const after = await agent.get(`/api/products/${product.id}`);
    expect(after.body.product.quantity_in_stock).toBe(8);

    const movements = await agent.get(`/api/products/${product.id}/movements`);
    expect(movements.body.total).toBe(1);

    await destroyProduct(product.id);
  });

  it('allows a movement that lands exactly on zero', async () => {
    const { agent, product } = await makeProduct(6);
    const response = await agent
      .post('/api/stock-movements')
      .send({ product_id: product.id, type: 'OUT', reason: 'damaged', quantity: 6, note: 'Written off' });

    expect(response.status).toBe(201);
    expect(response.body.balance_after).toBe(0);
    await destroyProduct(product.id);
  });
});

describe('movement validation (§3.3, §9)', () => {
  it('requires a note for count_correction, damaged and expired', async () => {
    const { agent, product } = await makeProduct(30);

    for (const reason of ['count_correction', 'damaged', 'expired']) {
      const response = await agent
        .post('/api/stock-movements')
        .send({ product_id: product.id, type: 'OUT', reason, quantity: 1 });
      expect(response.status, reason).toBe(400);
      expect(response.body.fields.note, reason).toBeTruthy();
    }

    const withNote = await agent.post('/api/stock-movements').send({
      product_id: product.id,
      type: 'OUT',
      reason: 'expired',
      quantity: 1,
      note: 'Past its shelf life',
    });
    expect(withNote.status).toBe(201);

    await destroyProduct(product.id);
  });

  it('refuses a reason that does not suit the direction', async () => {
    const { agent, product } = await makeProduct(30);

    const response = await agent
      .post('/api/stock-movements')
      .send({ product_id: product.id, type: 'IN', reason: 'sale_dispatch', quantity: 1 });

    expect(response.status).toBe(400);
    expect(response.body.fields.reason).toContain('OUT');

    await destroyProduct(product.id);
  });

  it('refuses reasons the system owns', async () => {
    const { agent, product } = await makeProduct(30);

    for (const reason of ['opening_balance', 'po_receipt']) {
      const response = await agent
        .post('/api/stock-movements')
        .send({ product_id: product.id, type: 'IN', reason, quantity: 1 });
      expect(response.status, reason).toBe(400);
      expect(response.body.fields.reason, reason).toBeTruthy();
    }

    await destroyProduct(product.id);
  });

  it('requires a whole quantity of at least 1', async () => {
    const { agent, product } = await makeProduct(30);

    for (const quantity of [0, -3, 2.5]) {
      const response = await agent
        .post('/api/stock-movements')
        .send({ product_id: product.id, type: 'OUT', reason: 'sale_dispatch', quantity });
      expect(response.status, String(quantity)).toBe(400);
    }

    await destroyProduct(product.id);
  });

  it('404s for a product that does not exist', async () => {
    const agent = await signIn(ACCOUNTS.staff);
    const response = await agent
      .post('/api/stock-movements')
      .send({ product_id: 999999, type: 'IN', reason: 'customer_return', quantity: 1 });
    expect(response.status).toBe(404);
  });
});

describe('GET /api/stock-movements', () => {
  it('lists the ledger with its filters', async () => {
    const agent = await signIn(ACCOUNTS.manager);

    const all = await agent.get('/api/stock-movements?limit=100');
    expect(all.status).toBe(200);
    expect(all.body.total).toBeGreaterThanOrEqual(77);

    const receipts = await agent.get('/api/stock-movements?reason=po_receipt&limit=100');
    for (const movement of receipts.body.rows) {
      expect(movement.reason).toBe('po_receipt');
    }

    const outs = await agent.get('/api/stock-movements?type=OUT&limit=5');
    for (const movement of outs.body.rows) {
      expect(movement.type).toBe('OUT');
      expect(movement.quantity_change).toBeLessThan(0);
    }
  });

  it('is closed to supplier users', async () => {
    const agent = await signIn(ACCOUNTS.supplierHarbourline);
    expect((await agent.get('/api/stock-movements')).status).toBe(403);
  });
});

describe('GET /api/products/low-stock — BR15', () => {
  it('returns the eight low products, worst shortfall first', async () => {
    const agent = await signIn(ACCOUNTS.staff);
    const { status, body } = await agent.get('/api/products/low-stock');

    expect(status).toBe(200);
    expect(body.count).toBe(8);

    const shortfalls = body.items.map((item: { shortfall: number }) => item.shortfall);
    expect(shortfalls).toEqual([...shortfalls].sort((a: number, b: number) => b - a));

    for (const item of body.items) {
      expect(item.quantity_in_stock).toBeLessThanOrEqual(item.min_stock_level);
      expect(item.shortfall).toBe(item.min_stock_level - item.quantity_in_stock);
      // min × 2 − quantity, the quantity S12's "Create order" pre-fills.
      expect(item.suggested_order_quantity).toBe(
        Math.max(item.min_stock_level * 2 - item.quantity_in_stock, 1)
      );
      expect(item.supplier_name).toEqual(expect.any(String));
    }
  });

  it('filters by supplier', async () => {
    const agent = await signIn(ACCOUNTS.staff);
    const { body } = await agent.get('/api/products/low-stock?supplier_id=1');
    expect(body.count).toBeGreaterThan(0);
    for (const item of body.items) expect(item.supplier_id).toBe(1);
  });

  it('drops a product off the list as soon as it is restocked', async () => {
    const { agent, product } = await makeProduct(3, 10);

    const before = await agent.get('/api/products/low-stock');
    expect(before.body.items.some((i: { id: number }) => i.id === product.id)).toBe(true);

    await agent
      .post('/api/stock-movements')
      .send({ product_id: product.id, type: 'IN', reason: 'customer_return', quantity: 20 });

    const after = await agent.get('/api/products/low-stock');
    expect(after.body.items.some((i: { id: number }) => i.id === product.id)).toBe(false);

    await destroyProduct(product.id);
  });

  it('is not a stored flag — nothing in the schema caches it', async () => {
    const column = await queryOne(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'products' AND column_name LIKE '%low%'`
    );
    expect(column).toBeNull();
  });
});
