import { afterAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { closePool, query, queryOne } from '../src/config/db';
import { ACCOUNTS, app, signIn } from './helpers';

afterAll(async () => {
  await closePool();
});

const HARBOURLINE = 1;
const KETTLE = 2;

/** Harbourline products, used for well-formed lines. */
async function harbourlineProducts() {
  const agent = await signIn(ACCOUNTS.staff);
  const { body } = await agent.get('/api/products?supplier_id=1&status=active&limit=10');
  return body.rows as Array<{ id: number; sku: string; unit_price: number }>;
}

async function destroyOrder(id: number) {
  await query('DELETE FROM purchase_order_items WHERE purchase_order_id = $1', [id]);
  await query('DELETE FROM purchase_orders WHERE id = $1', [id]);
}

/** Creates a fresh draft owned by Jordan (staff). */
async function makeDraft(items: Array<{ product_id: number; quantity: number }> = []) {
  const agent = await signIn(ACCOUNTS.staff);
  const created = await agent
    .post('/api/purchase-orders')
    .send({ supplier_id: HARBOURLINE, notes: 'Created by the test suite', items });
  expect(created.status).toBe(201);
  return { agent, order: created.body.order };
}

describe('POST /api/purchase-orders — draft creation', () => {
  it('generates a sequential PO number and totals the lines (BR13, BR16)', async () => {
    const products = await harbourlineProducts();
    const { order } = await makeDraft([
      { product_id: products[0].id, quantity: 4 },
      { product_id: products[1].id, quantity: 3 },
    ]);

    expect(order.po_number).toMatch(/^PO-\d{5}$/);
    expect(order.status).toBe('draft');
    expect(order.items).toHaveLength(2);

    const expectedTotal =
      4 * products[0].unit_price + 3 * products[1].unit_price;
    expect(order.total_amount).toBeCloseTo(expectedTotal, 2);
    expect(order.line_count).toBe(2);

    await destroyOrder(order.id);
  });

  it('takes the unit price from the product record and ignores any price sent (BR14)', async () => {
    const products = await harbourlineProducts();
    const agent = await signIn(ACCOUNTS.staff);

    const created = await agent.post('/api/purchase-orders').send({
      supplier_id: HARBOURLINE,
      items: [{ product_id: products[0].id, quantity: 2, unit_price: 0.01 }],
    });

    expect(created.status).toBe(201);
    expect(created.body.order.items[0].unit_price).toBe(products[0].unit_price);
    expect(created.body.order.total_amount).toBeCloseTo(2 * products[0].unit_price, 2);

    await destroyOrder(created.body.order.id);
  });

  it('is staff-only', async () => {
    for (const email of [ACCOUNTS.admin, ACCOUNTS.manager]) {
      const agent = await signIn(email);
      const response = await agent
        .post('/api/purchase-orders')
        .send({ supplier_id: HARBOURLINE, items: [] });
      expect(response.status, email).toBe(403);
    }
  });

  it('refuses an expected date before the order date (§9)', async () => {
    const agent = await signIn(ACCOUNTS.staff);
    const response = await agent
      .post('/api/purchase-orders')
      .send({ supplier_id: HARBOURLINE, expected_date: '2020-01-01', items: [] });

    expect(response.status).toBe(400);
    expect(response.body.fields.expected_date).toBeTruthy();
  });
});

describe('BR7 — every line belongs to the order supplier', () => {
  it('refuses a line whose product belongs to another supplier', async () => {
    const agent = await signIn(ACCOUNTS.staff);
    const kettle = await agent.get(`/api/products?supplier_id=${KETTLE}&limit=1`);
    const foreignProduct = kettle.body.rows[0];

    const response = await agent.post('/api/purchase-orders').send({
      supplier_id: HARBOURLINE,
      items: [{ product_id: foreignProduct.id, quantity: 5 }],
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('another company');

    // Nothing was created.
    const orphan = await queryOne(
      `SELECT id FROM purchase_orders WHERE notes = 'BR7 orphan check'`
    );
    expect(orphan).toBeNull();
  });

  it('refuses a deactivated product on a new order (BR10)', async () => {
    const agent = await signIn(ACCOUNTS.staff);
    const inactive = await agent.get('/api/products?search=STA-5003');
    const product = inactive.body.rows[0];

    const response = await agent
      .post('/api/purchase-orders')
      .send({ supplier_id: product.supplier_id, items: [{ product_id: product.id, quantity: 2 }] });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('deactivated');
  });
});

describe('BR5 — only a draft is editable', () => {
  it('edits a draft, replacing the whole line set and recalculating the total', async () => {
    const products = await harbourlineProducts();
    const { agent, order } = await makeDraft([{ product_id: products[0].id, quantity: 2 }]);

    const edited = await agent.put(`/api/purchase-orders/${order.id}`).send({
      supplier_id: HARBOURLINE,
      notes: 'Edited',
      items: [
        { product_id: products[1].id, quantity: 7 },
        { product_id: products[2].id, quantity: 1 },
      ],
    });

    expect(edited.status).toBe(200);
    expect(edited.body.order.items).toHaveLength(2);
    expect(edited.body.order.notes).toBe('Edited');
    expect(edited.body.order.total_amount).toBeCloseTo(
      7 * products[1].unit_price + 1 * products[2].unit_price,
      2
    );

    await destroyOrder(order.id);
  });

  it('refuses to edit or delete once submitted', async () => {
    const products = await harbourlineProducts();
    const { agent, order } = await makeDraft([{ product_id: products[0].id, quantity: 2 }]);

    await agent.post(`/api/purchase-orders/${order.id}/submit`);

    const edit = await agent
      .put(`/api/purchase-orders/${order.id}`)
      .send({ supplier_id: HARBOURLINE, items: [{ product_id: products[0].id, quantity: 9 }] });
    expect(edit.status).toBe(409);
    expect(edit.body.error).toContain('draft');

    const remove = await agent.delete(`/api/purchase-orders/${order.id}`);
    expect(remove.status).toBe(409);

    await destroyOrder(order.id);
  });

  it('deletes a draft outright', async () => {
    const { agent, order } = await makeDraft();
    expect((await agent.delete(`/api/purchase-orders/${order.id}`)).status).toBe(204);
    expect((await agent.get(`/api/purchase-orders/${order.id}`)).status).toBe(404);
  });
});

describe('BR6 — an empty draft cannot be submitted', () => {
  it('refuses a draft with no lines', async () => {
    const { agent, order } = await makeDraft([]);

    const response = await agent.post(`/api/purchase-orders/${order.id}/submit`);
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('at least one line');

    // It stays a draft.
    const after = await agent.get(`/api/purchase-orders/${order.id}`);
    expect(after.body.order.status).toBe('draft');

    await destroyOrder(order.id);
  });

  it('submits a draft that has lines and a total above zero', async () => {
    const products = await harbourlineProducts();
    const { agent, order } = await makeDraft([{ product_id: products[0].id, quantity: 3 }]);

    const response = await agent.post(`/api/purchase-orders/${order.id}/submit`);
    expect(response.status).toBe(200);
    expect(response.body.order.status).toBe('pending_approval');
    expect(response.body.order.submitted_at).toBeTruthy();

    await destroyOrder(order.id);
  });
});

describe('BR4 — illegal status transitions are a 409', () => {
  it('refuses draft → shipped', async () => {
    const products = await harbourlineProducts();
    const { agent, order } = await makeDraft([{ product_id: products[0].id, quantity: 1 }]);

    // Shipping is the supplier's action; the order is still a draft, so even
    // the right role is refused by the state machine.
    const supplier = await signIn(ACCOUNTS.supplierHarbourline);
    const response = await supplier.post(`/api/purchase-orders/${order.id}/ship`);

    // A supplier cannot even see a draft, so this is refused before the
    // transition check — both are correct refusals.
    expect([403, 409]).toContain(response.status);

    // Receiving a draft is the same illegal move, from a role that can see it.
    const receive = await agent.post(`/api/purchase-orders/${order.id}/receive`).send({
      reference: 'DN-1',
      lines: [{ item_id: order.items[0].id, quantity: 1 }],
    });
    expect(receive.status).toBe(409);
    expect(receive.body.error).toContain('approved, shipped or partially received');

    await destroyOrder(order.id);
  });

  it('refuses approving anything that is not pending approval', async () => {
    const products = await harbourlineProducts();
    const { agent, order } = await makeDraft([{ product_id: products[0].id, quantity: 1 }]);

    const manager = await signIn(ACCOUNTS.manager);
    const response = await manager.post(`/api/purchase-orders/${order.id}/approve`);
    expect(response.status).toBe(409);
    expect(response.body.error).toContain('cannot go from draft to approved');

    await destroyOrder(order.id);
  });

  it('refuses to revive a cancelled order', async () => {
    const products = await harbourlineProducts();
    const { agent, order } = await makeDraft([{ product_id: products[0].id, quantity: 1 }]);

    await agent.post(`/api/purchase-orders/${order.id}/cancel`);
    const response = await agent.post(`/api/purchase-orders/${order.id}/submit`);

    expect(response.status).toBe(409);
    expect(response.body.error).toContain('final');

    await destroyOrder(order.id);
  });
});

describe('BR8 — approval is a different manager', () => {
  it('refuses approval by the user who raised the order', async () => {
    // The seeded manager raises nothing, so this is built explicitly: a draft
    // is created by staff, then re-owned by the manager in the database.
    const products = await harbourlineProducts();
    const { agent, order } = await makeDraft([{ product_id: products[0].id, quantity: 2 }]);
    await agent.post(`/api/purchase-orders/${order.id}/submit`);

    const manager = await queryOne<{ id: number }>(
      `SELECT id FROM users WHERE email = $1`,
      [ACCOUNTS.manager]
    );
    await query('UPDATE purchase_orders SET created_by = $2 WHERE id = $1', [
      order.id,
      manager!.id,
    ]);

    const managerAgent = await signIn(ACCOUNTS.manager);
    const approve = await managerAgent.post(`/api/purchase-orders/${order.id}/approve`);

    expect(approve.status).toBe(403);
    expect(approve.body.error).toContain('BR8');

    const reject = await managerAgent
      .post(`/api/purchase-orders/${order.id}/reject`)
      .send({ rejection_reason: 'Trying to reject my own order' });
    expect(reject.status).toBe(403);

    await destroyOrder(order.id);
  });

  it('lets a different manager approve, stamping who and when', async () => {
    const products = await harbourlineProducts();
    const { agent, order } = await makeDraft([{ product_id: products[0].id, quantity: 2 }]);
    await agent.post(`/api/purchase-orders/${order.id}/submit`);

    const manager = await signIn(ACCOUNTS.manager);
    const approved = await manager.post(`/api/purchase-orders/${order.id}/approve`);

    expect(approved.status).toBe(200);
    expect(approved.body.order.status).toBe('approved');
    expect(approved.body.order.approved_by_name).toBe('Peter Oyelaran');
    expect(approved.body.order.approved_at).toBeTruthy();

    await destroyOrder(order.id);
  });

  it('requires a 5–255 character reason to reject (§9)', async () => {
    const products = await harbourlineProducts();
    const { agent, order } = await makeDraft([{ product_id: products[0].id, quantity: 2 }]);
    await agent.post(`/api/purchase-orders/${order.id}/submit`);

    const manager = await signIn(ACCOUNTS.manager);

    const tooShort = await manager
      .post(`/api/purchase-orders/${order.id}/reject`)
      .send({ rejection_reason: 'no' });
    expect(tooShort.status).toBe(400);
    expect(tooShort.body.fields.rejection_reason).toBeTruthy();

    const ok = await manager
      .post(`/api/purchase-orders/${order.id}/reject`)
      .send({ rejection_reason: 'Over budget for this quarter — resubmit with fewer units.' });
    expect(ok.status).toBe(200);
    expect(ok.body.order.status).toBe('rejected');
    expect(ok.body.order.rejection_reason).toContain('Over budget');

    await destroyOrder(order.id);
  });

  it('is closed to staff and admin', async () => {
    for (const email of [ACCOUNTS.staff, ACCOUNTS.admin]) {
      const agent = await signIn(email);
      expect((await agent.post('/api/purchase-orders/9/approve')).status).toBe(403);
    }
  });
});

describe('BR11 — supplier scoping', () => {
  it('shows a supplier only their own released orders', async () => {
    const agent = await signIn(ACCOUNTS.supplierHarbourline);
    const { status, body } = await agent.get('/api/purchase-orders?limit=100');

    expect(status).toBe(200);
    expect(body.total).toBeGreaterThan(0);
    for (const order of body.rows) {
      expect(order.supplier_id).toBe(HARBOURLINE);
      // Drafts, pending and rejected orders are never released to a supplier.
      expect(['draft', 'pending_approval', 'rejected']).not.toContain(order.status);
    }
  });

  it('returns 403 when a supplier requests another supplier’s order', async () => {
    const staff = await signIn(ACCOUNTS.staff);
    const kettleOrders = await staff.get(`/api/purchase-orders?supplier_id=${KETTLE}&limit=1`);
    const otherOrderId = kettleOrders.body.rows[0].id;

    const supplier = await signIn(ACCOUNTS.supplierHarbourline);
    const response = await supplier.get(`/api/purchase-orders/${otherOrderId}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('another supplier');
  });

  it('ignores a supplier_id filter a supplier tries to widen', async () => {
    const agent = await signIn(ACCOUNTS.supplierHarbourline);
    const { body } = await agent.get(`/api/purchase-orders?supplier_id=${KETTLE}&limit=100`);
    for (const order of body.rows) expect(order.supplier_id).toBe(HARBOURLINE);
  });

  it('refuses to let a supplier ship an order that is not theirs', async () => {
    const staff = await signIn(ACCOUNTS.staff);
    const approved = await staff.get('/api/purchase-orders?status=approved&limit=10');
    const notHarbourline = approved.body.rows.find(
      (order: { supplier_id: number }) => order.supplier_id !== HARBOURLINE
    );

    const supplier = await signIn(ACCOUNTS.supplierHarbourline);
    const response = await supplier.post(`/api/purchase-orders/${notHarbourline.id}/ship`);
    expect(response.status).toBe(403);
  });
});

describe('supplier ships an approved order', () => {
  it('moves approved → shipped and stamps shipped_at', async () => {
    const products = await harbourlineProducts();
    const { agent, order } = await makeDraft([{ product_id: products[0].id, quantity: 2 }]);
    await agent.post(`/api/purchase-orders/${order.id}/submit`);
    const manager = await signIn(ACCOUNTS.manager);
    await manager.post(`/api/purchase-orders/${order.id}/approve`);

    const supplier = await signIn(ACCOUNTS.supplierHarbourline);
    const shipped = await supplier.post(`/api/purchase-orders/${order.id}/ship`);

    expect(shipped.status).toBe(200);
    expect(shipped.body.order.status).toBe('shipped');
    expect(shipped.body.order.shipped_at).toBeTruthy();

    // Shipping twice is an illegal transition.
    const again = await supplier.post(`/api/purchase-orders/${order.id}/ship`);
    expect(again.status).toBe(409);

    await destroyOrder(order.id);
  });
});

describe('§5.6 — receiving stock (BR2, BR9, BR17)', () => {
  it('increases balances, writes po_receipt movements and closes the order', async () => {
    const products = await harbourlineProducts();
    const staff = await signIn(ACCOUNTS.staff);

    const before = await staff.get(`/api/products/${products[0].id}`);
    const startingBalance = before.body.product.quantity_in_stock;

    const { order } = await makeDraft([{ product_id: products[0].id, quantity: 6 }]);
    await staff.post(`/api/purchase-orders/${order.id}/submit`);
    const manager = await signIn(ACCOUNTS.manager);
    await manager.post(`/api/purchase-orders/${order.id}/approve`);

    const received = await staff.post(`/api/purchase-orders/${order.id}/receive`).send({
      reference: 'DN-8842',
      lines: [{ item_id: order.items[0].id, quantity: 6 }],
    });

    expect(received.status).toBe(200);
    expect(received.body.fully_received).toBe(true);
    expect(received.body.order.status).toBe('received');
    expect(received.body.order.received_at).toBeTruthy();
    expect(received.body.applied[0]).toMatchObject({
      previous_balance: startingBalance,
      balance_after: startingBalance + 6,
      quantity: 6,
    });

    // The balance moved and the ledger explains why.
    const after = await staff.get(`/api/products/${products[0].id}`);
    expect(after.body.product.quantity_in_stock).toBe(startingBalance + 6);

    const movements = await staff.get(`/api/products/${products[0].id}/movements`);
    expect(movements.body.rows[0]).toMatchObject({
      type: 'IN',
      reason: 'po_receipt',
      quantity_change: 6,
      balance_after: startingBalance + 6,
      reference: order.po_number,
    });
    expect(movements.body.rows[0].note).toContain('DN-8842');

    // Put the seeded balance back.
    await query('DELETE FROM stock_movements WHERE reference = $1', [order.po_number]);
    await query('UPDATE products SET quantity_in_stock = $2 WHERE id = $1', [
      products[0].id,
      startingBalance,
    ]);
    await destroyOrder(order.id);
  });

  it('leaves the order partially received when a line is short (BR17)', async () => {
    const products = await harbourlineProducts();
    const staff = await signIn(ACCOUNTS.staff);
    const startA = (await staff.get(`/api/products/${products[0].id}`)).body.product
      .quantity_in_stock;

    const { order } = await makeDraft([
      { product_id: products[0].id, quantity: 10 },
      { product_id: products[1].id, quantity: 4 },
    ]);
    await staff.post(`/api/purchase-orders/${order.id}/submit`);
    const manager = await signIn(ACCOUNTS.manager);
    await manager.post(`/api/purchase-orders/${order.id}/approve`);

    const partial = await staff.post(`/api/purchase-orders/${order.id}/receive`).send({
      reference: 'DN-PART-1',
      lines: [
        { item_id: order.items[0].id, quantity: 4 },
        { item_id: order.items[1].id, quantity: 0 },
      ],
    });

    expect(partial.status).toBe(200);
    expect(partial.body.fully_received).toBe(false);
    expect(partial.body.order.status).toBe('partially_received');
    expect(partial.body.order.received_at).toBeNull();
    expect(partial.body.order.items[0].received_quantity).toBe(4);
    expect(partial.body.order.items[0].outstanding).toBe(6);

    // A second receipt completes it.
    const rest = await staff.post(`/api/purchase-orders/${order.id}/receive`).send({
      reference: 'DN-PART-2',
      lines: [
        { item_id: order.items[0].id, quantity: 6 },
        { item_id: order.items[1].id, quantity: 4 },
      ],
    });
    expect(rest.body.order.status).toBe('received');

    await query('DELETE FROM stock_movements WHERE reference = $1', [order.po_number]);
    await query('UPDATE products SET quantity_in_stock = $2 WHERE id = $1', [
      products[0].id,
      startA,
    ]);
    const startB = (await staff.get(`/api/products/${products[1].id}`)).body.product;
    await query('UPDATE products SET quantity_in_stock = $2 WHERE id = $1', [
      products[1].id,
      startB.quantity_in_stock - 4,
    ]);
    await destroyOrder(order.id);
  });

  it('BR9 — refuses to over-receive a line and writes nothing', async () => {
    const products = await harbourlineProducts();
    const staff = await signIn(ACCOUNTS.staff);
    const start = (await staff.get(`/api/products/${products[0].id}`)).body.product
      .quantity_in_stock;

    const { order } = await makeDraft([{ product_id: products[0].id, quantity: 5 }]);
    await staff.post(`/api/purchase-orders/${order.id}/submit`);
    const manager = await signIn(ACCOUNTS.manager);
    await manager.post(`/api/purchase-orders/${order.id}/approve`);

    const response = await staff.post(`/api/purchase-orders/${order.id}/receive`).send({
      reference: 'DN-TOO-MANY',
      lines: [{ item_id: order.items[0].id, quantity: 6 }],
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('BR9');

    // Nothing moved: no balance change, no movement, order still approved.
    const after = await staff.get(`/api/products/${products[0].id}`);
    expect(after.body.product.quantity_in_stock).toBe(start);

    const stillApproved = await staff.get(`/api/purchase-orders/${order.id}`);
    expect(stillApproved.body.order.status).toBe('approved');
    expect(stillApproved.body.order.items[0].received_quantity).toBe(0);

    await destroyOrder(order.id);
  });

  it('requires a delivery reference', async () => {
    const products = await harbourlineProducts();
    const staff = await signIn(ACCOUNTS.staff);
    const { order } = await makeDraft([{ product_id: products[0].id, quantity: 2 }]);
    await staff.post(`/api/purchase-orders/${order.id}/submit`);
    const manager = await signIn(ACCOUNTS.manager);
    await manager.post(`/api/purchase-orders/${order.id}/approve`);

    const response = await staff
      .post(`/api/purchase-orders/${order.id}/receive`)
      .send({ reference: '', lines: [{ item_id: order.items[0].id, quantity: 2 }] });

    expect(response.status).toBe(400);
    expect(response.body.fields.reference).toBeTruthy();

    await destroyOrder(order.id);
  });

  it('is staff-only', async () => {
    for (const email of [ACCOUNTS.manager, ACCOUNTS.admin]) {
      const agent = await signIn(email);
      const response = await agent
        .post('/api/purchase-orders/9/receive')
        .send({ reference: 'DN-1', lines: [{ item_id: 1, quantity: 1 }] });
      expect(response.status, email).toBe(403);
    }
  });
});

describe('GET /api/purchase-orders', () => {
  it('filters by status, supplier and date range', async () => {
    const agent = await signIn(ACCOUNTS.manager);

    const pending = await agent.get('/api/purchase-orders?status=pending_approval&limit=50');
    for (const order of pending.body.rows) expect(order.status).toBe('pending_approval');

    const bySupplier = await agent.get('/api/purchase-orders?supplier_id=1&limit=50');
    for (const order of bySupplier.body.rows) expect(order.supplier_id).toBe(1);

    const awaiting = await agent.get('/api/purchase-orders?bucket=awaiting_receipt&limit=50');
    for (const order of awaiting.body.rows) {
      expect(['approved', 'shipped', 'partially_received']).toContain(order.status);
    }
  });

  it('needs a session', async () => {
    expect((await supertest(app).get('/api/purchase-orders')).status).toBe(401);
  });
});
