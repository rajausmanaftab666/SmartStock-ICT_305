import { describe, expect, it } from 'vitest';
import { buildLedger } from '../src/db/ledger';
import { products, purchaseOrders, suppliers, users } from '../src/db/seed-data';

/**
 * The seed script asserts these same invariants against the live database
 * before it commits. Running them here as well means a bad edit to the demo
 * data is caught in milliseconds, without a PostgreSQL connection.
 */
describe('seed ledger', () => {
  const { rows } = buildLedger();

  it('gives every product a movement history', () => {
    for (const product of products) {
      const mine = rows.filter((r) => r.productSeedId === product.seedId);
      expect(mine.length, `${product.sku} has no movements`).toBeGreaterThan(0);
    }
  });

  it('closes each product on its stored quantity (BR1)', () => {
    for (const product of products) {
      const mine = rows.filter((r) => r.productSeedId === product.seedId);
      const last = mine[mine.length - 1];
      expect(last.balanceAfter, `${product.sku} closing balance`).toBe(product.quantityInStock);
    }
  });

  it('keeps balance_after equal to the running total (BR2)', () => {
    for (const product of products) {
      let running = 0;
      for (const movement of rows.filter((r) => r.productSeedId === product.seedId)) {
        running += movement.quantityChange;
        expect(movement.balanceAfter, `${product.sku} running balance`).toBe(running);
      }
    }
  });

  it('never lets a balance go negative (BR3)', () => {
    for (const movement of rows) {
      expect(movement.balanceAfter).toBeGreaterThanOrEqual(0);
    }
  });

  it('signs every movement to match its direction (BR2)', () => {
    for (const movement of rows) {
      if (movement.type === 'IN') expect(movement.quantityChange).toBeGreaterThan(0);
      else expect(movement.quantityChange).toBeLessThan(0);
    }
  });

  it('records po_receipt movements that match what each order received', () => {
    for (const po of purchaseOrders) {
      for (const line of po.lines) {
        if (line.receivedQuantity <= 0) continue;
        const received = rows
          .filter(
            (r) =>
              r.reason === 'po_receipt' &&
              r.reference === po.poNumber &&
              r.productSeedId === line.productSeedId
          )
          .reduce((sum, r) => sum + r.quantityChange, 0);
        expect(received, `${po.poNumber} / product ${line.productSeedId}`).toBe(
          line.receivedQuantity
        );
      }
    }
  });

  it('spans the last 60 days and stays within the specified volume', () => {
    const offsets = rows.map((r) => r.dayOffset);
    expect(Math.min(...offsets)).toBeGreaterThanOrEqual(-60);
    expect(Math.max(...offsets)).toBeLessThanOrEqual(0);
    expect(rows.length).toBeGreaterThanOrEqual(60);
    expect(rows.length).toBeLessThanOrEqual(80);
  });
});

describe('seed catalogue', () => {
  it('matches the shape the specification asks for', () => {
    expect(products).toHaveLength(40);
    expect(suppliers).toHaveLength(6);
    expect(suppliers.filter((s) => s.status === 'active')).toHaveLength(5);
    expect(users).toHaveLength(7);
    expect(users.filter((u) => u.status === 'inactive')).toHaveLength(1);
  });

  it('puts eight active products at or below their minimum (BR15)', () => {
    const low = products.filter(
      (p) => p.status === 'active' && p.quantityInStock <= p.minStockLevel
    );
    expect(low).toHaveLength(8);
  });

  it('links supplier users to a supplier and no one else (BR18)', () => {
    for (const user of users) {
      if (user.role === 'supplier') expect(user.supplierSeedId).not.toBeNull();
      else expect(user.supplierSeedId).toBeNull();
    }
  });

  it('keeps every purchase order line with its order supplier (BR7)', () => {
    for (const po of purchaseOrders) {
      for (const line of po.lines) {
        const product = products.find((p) => p.seedId === line.productSeedId);
        expect(product?.supplierSeedId, `${po.poNumber} line`).toBe(po.supplierSeedId);
      }
    }
  });

  it('covers every purchase order status', () => {
    const seen = new Set(purchaseOrders.map((po) => po.status));
    for (const status of [
      'draft',
      'pending_approval',
      'approved',
      'rejected',
      'shipped',
      'partially_received',
      'received',
      'cancelled',
    ]) {
      expect(seen.has(status as never), `no ${status} order in the seed`).toBe(true);
    }
  });

  it('puts the worst shortfall with a supplier who can log in and ship', () => {
    const worst = products
      .filter((p) => p.status === 'active' && p.quantityInStock <= p.minStockLevel)
      .sort(
        (a, b) =>
          b.minStockLevel - b.quantityInStock - (a.minStockLevel - a.quantityInStock) ||
          a.name.localeCompare(b.name)
      )[0];

    const hasLogin = users.some(
      (u) => u.role === 'supplier' && u.status === 'active' && u.supplierSeedId === worst.supplierSeedId
    );
    expect(hasLogin, `${worst.sku}'s supplier has no active login — the demo stalls at step 4`).toBe(
      true
    );
  });

  it('leaves an approved order for a supplier who can actually log in', () => {
    const shippable = purchaseOrders.filter(
      (po) =>
        po.status === 'approved' &&
        users.some(
          (u) =>
            u.role === 'supplier' && u.status === 'active' && u.supplierSeedId === po.supplierSeedId
        )
    );
    expect(shippable.length, 'demo script step 4 would be unreachable').toBeGreaterThan(0);
  });

  it('never over-receives a line (BR9)', () => {
    for (const po of purchaseOrders) {
      for (const line of po.lines) {
        expect(line.receivedQuantity).toBeLessThanOrEqual(line.quantity);
      }
    }
  });
});
