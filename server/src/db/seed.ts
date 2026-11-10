import bcrypt from 'bcrypt';
import type { PoolClient } from 'pg';
import { withTransaction, closePool } from '../config/db';
import { env } from '../config/env';
import { buildLedger } from './ledger';
import {
  APPROVER_SEED_ID,
  HIGHEST_PO_SEQUENCE,
  categories,
  products,
  purchaseOrders,
  settings,
  suppliers,
  users,
} from './seed-data';

/**
 * Idempotent demo seed. `npm run seed` truncates every table and reloads the
 * same data, so the demo database can be reset between rehearsals without
 * touching the schema.
 *
 * The ledger itself is built by ./ledger.ts, which is pure and unit tested.
 * A verification pass here re-checks it against the database and refuses to
 * commit if any product's stored balance disagrees with its movements.
 */

// ---------------------------------------------------------------------------
// Date helpers — everything is expressed relative to the moment the seed runs,
// so "last 30 days" charts stay populated whenever the database is rebuilt.
// ---------------------------------------------------------------------------

const SEED_MIDNIGHT = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
})();

function at(dayOffset: number, minutesIntoDay = 540): Date {
  const d = new Date(SEED_MIDNIGHT);
  d.setDate(d.getDate() + dayOffset);
  d.setMinutes(minutesIntoDay);
  return d;
}

function isoDate(dayOffset: number): string {
  const d = new Date(SEED_MIDNIGHT);
  d.setDate(d.getDate() + dayOffset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Insert
// ---------------------------------------------------------------------------

const TABLES = [
  'purchase_order_items',
  'purchase_orders',
  'stock_movements',
  'products',
  'categories',
  'settings',
  'users',
  'suppliers',
  'session',
];

async function seed(client: PoolClient): Promise<void> {
  await client.query(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);

  // -- suppliers ------------------------------------------------------------
  const supplierIds = new Map<number, number>();
  for (const s of suppliers) {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO suppliers (name, contact_person, email, phone, address, lead_time_days, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [s.name, s.contactPerson, s.email, s.phone, s.address, s.leadTimeDays, s.status]
    );
    supplierIds.set(s.seedId, rows[0].id);
  }

  // -- users ----------------------------------------------------------------
  // One hash reused across the demo accounts: bcrypt is deliberately slow, and
  // seven separate hashes would add seconds to every reset for no benefit.
  const passwordHash = await bcrypt.hash(env.SEED_PASSWORD, 10);
  const userIds = new Map<number, number>();
  for (const u of users) {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO users (name, email, password_hash, role, supplier_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING id`,
      [
        u.name,
        u.email,
        passwordHash,
        u.role,
        u.supplierSeedId === null ? null : supplierIds.get(u.supplierSeedId),
        u.status,
        at(u.createdDayOffset),
      ]
    );
    userIds.set(u.seedId, rows[0].id);
  }

  // -- categories -----------------------------------------------------------
  const categoryIds = new Map<number, number>();
  for (const c of categories) {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING id`,
      [c.name, c.description]
    );
    categoryIds.set(c.seedId, rows[0].id);
  }

  // -- ledger (built first so product creation dates line up with it) -------
  const { rows: ledger, openingDates } = buildLedger();

  // -- products -------------------------------------------------------------
  const productIds = new Map<number, number>();
  for (const p of products) {
    const created = at(openingDates.get(p.seedId) ?? -60, 530);
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO products
         (sku, name, description, category_id, supplier_id, unit, unit_price,
          quantity_in_stock, min_stock_level, status, created_by, updated_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
      [
        p.sku,
        p.name,
        p.description,
        categoryIds.get(p.categorySeedId),
        supplierIds.get(p.supplierSeedId),
        p.unit,
        p.unitPrice,
        p.quantityInStock,
        p.minStockLevel,
        p.status,
        userIds.get(2),
        p.seedId % 3 === 0 ? userIds.get(3) : null,
        created,
        at(-2, 552),
      ]
    );
    productIds.set(p.seedId, rows[0].id);
  }

  // -- stock movements ------------------------------------------------------
  for (const m of ledger) {
    await client.query(
      `INSERT INTO stock_movements
         (product_id, type, reason, quantity_change, balance_after, reference, note, user_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        productIds.get(m.productSeedId),
        m.type,
        m.reason,
        m.quantityChange,
        m.balanceAfter,
        m.reference,
        m.note,
        userIds.get(m.userSeedId),
        at(m.dayOffset, m.minutesIntoDay),
      ]
    );
  }

  // -- purchase orders ------------------------------------------------------
  const approverId = userIds.get(APPROVER_SEED_ID)!;
  const decided = new Set(['approved', 'rejected', 'shipped', 'partially_received', 'received']);
  const submitted = new Set([...decided, 'pending_approval']);

  for (const po of purchaseOrders) {
    const total = round2(po.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0));
    const isDecided = decided.has(po.status);
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO purchase_orders
         (po_number, supplier_id, status, order_date, expected_date, total_amount, notes,
          created_by, approved_by, approved_at, rejection_reason,
          submitted_at, shipped_at, received_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15) RETURNING id`,
      [
        po.poNumber,
        supplierIds.get(po.supplierSeedId),
        po.status,
        isoDate(po.orderDayOffset),
        isoDate(po.expectedDayOffset),
        total,
        po.notes || null,
        userIds.get(po.createdBySeedId),
        // approved_by doubles as "decided by": the schema has no separate
        // rejected_by column, and S17's timeline needs to name the manager who
        // rejected an order.
        isDecided ? approverId : null,
        isDecided ? at(po.orderDayOffset + 1, 620) : null,
        po.rejectionReason ?? null,
        submitted.has(po.status) ? at(po.orderDayOffset, 900) : null,
        po.shippedDayOffset === undefined ? null : at(po.shippedDayOffset, 700),
        po.receivedDayOffset === undefined ? null : at(po.receivedDayOffset, 760),
        at(po.orderDayOffset, 540),
      ]
    );
    const poId = rows[0].id;

    for (const line of po.lines) {
      await client.query(
        `INSERT INTO purchase_order_items
           (purchase_order_id, product_id, quantity, received_quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          poId,
          productIds.get(line.productSeedId),
          line.quantity,
          line.receivedQuantity,
          line.unitPrice,
          round2(line.quantity * line.unitPrice),
        ]
      );
    }
  }

  await client.query(`SELECT setval('po_number_seq', $1, true)`, [HIGHEST_PO_SEQUENCE]);

  // -- settings -------------------------------------------------------------
  for (const [key, value] of settings) {
    await client.query(
      `INSERT INTO settings (setting_key, setting_value, updated_by) VALUES ($1, $2, $3)`,
      [key, value, userIds.get(1)]
    );
  }
}

// ---------------------------------------------------------------------------
// Verification — the seed refuses to commit an inconsistent database.
// ---------------------------------------------------------------------------

async function verify(client: PoolClient): Promise<string[]> {
  const problems: string[] = [];

  const { rows: drift } = await client.query<{ sku: string; stored: number; ledger: number }>(
    `SELECT p.sku,
            p.quantity_in_stock AS stored,
            COALESCE(SUM(m.quantity_change), 0)::int AS ledger
       FROM products p
       LEFT JOIN stock_movements m ON m.product_id = p.id
      GROUP BY p.id, p.sku, p.quantity_in_stock
     HAVING p.quantity_in_stock <> COALESCE(SUM(m.quantity_change), 0)`
  );
  for (const row of drift) {
    problems.push(`${row.sku}: stored ${row.stored} but the ledger sums to ${row.ledger} (BR1/BR2)`);
  }

  const { rows: negative } = await client.query<{ sku: string; balance_after: number }>(
    `SELECT p.sku, m.balance_after
       FROM stock_movements m JOIN products p ON p.id = m.product_id
      WHERE m.balance_after < 0`
  );
  for (const row of negative) {
    problems.push(`${row.sku}: a movement leaves a negative balance of ${row.balance_after} (BR3)`);
  }

  const { rows: tailDrift } = await client.query<{ sku: string; stored: number; latest: number }>(
    `SELECT p.sku, p.quantity_in_stock AS stored, last.balance_after AS latest
       FROM products p
       JOIN LATERAL (
         SELECT balance_after FROM stock_movements m
          WHERE m.product_id = p.id
          ORDER BY m.created_at DESC, m.id DESC LIMIT 1
       ) last ON TRUE
      WHERE last.balance_after <> p.quantity_in_stock`
  );
  for (const row of tailDrift) {
    problems.push(
      `${row.sku}: newest movement closes at ${row.latest} but the product holds ${row.stored}`
    );
  }

  const { rows: over } = await client.query<{ po_number: string }>(
    `SELECT po.po_number FROM purchase_order_items i
       JOIN purchase_orders po ON po.id = i.purchase_order_id
      WHERE i.received_quantity > i.quantity`
  );
  for (const row of over) {
    problems.push(`${row.po_number}: a line is over-received (BR9)`);
  }

  const { rows: mismatch } = await client.query<{ po_number: string }>(
    `SELECT po.po_number
       FROM purchase_orders po
       LEFT JOIN purchase_order_items i ON i.purchase_order_id = po.id
      GROUP BY po.id, po.po_number, po.total_amount
     HAVING po.total_amount <> COALESCE(SUM(i.line_total), 0)`
  );
  for (const row of mismatch) {
    problems.push(`${row.po_number}: total_amount does not equal the sum of its lines (BR16)`);
  }

  const { rows: wrongSupplier } = await client.query<{ po_number: string; sku: string }>(
    `SELECT po.po_number, p.sku
       FROM purchase_order_items i
       JOIN purchase_orders po ON po.id = i.purchase_order_id
       JOIN products p ON p.id = i.product_id
      WHERE p.supplier_id <> po.supplier_id`
  );
  for (const row of wrongSupplier) {
    problems.push(`${row.po_number}: line ${row.sku} belongs to another supplier (BR7)`);
  }

  const { rows: demoPath } = await client.query<{ po_number: string }>(
    `SELECT po.po_number FROM purchase_orders po
       JOIN users u ON u.supplier_id = po.supplier_id AND u.role = 'supplier' AND u.status = 'active'
      WHERE po.status = 'approved' LIMIT 1`
  );
  if (demoPath.length === 0) {
    problems.push(
      'No approved order belongs to a supplier company with an active supplier user — step 4 of the demo script would be unreachable.'
    );
  }

  // The demo starts by raising an order from the worst low-stock row. If that
  // product's supplier has no active login, the order can never be shipped and
  // the demo stalls at step 4.
  const { rows: worstLow } = await client.query<{ sku: string; supplier: string; has_login: boolean }>(
    `SELECT p.sku,
            s.name AS supplier,
            EXISTS (SELECT 1 FROM users u
                     WHERE u.supplier_id = p.supplier_id
                       AND u.role = 'supplier' AND u.status = 'active') AS has_login
       FROM products p
       JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.status = 'active' AND p.quantity_in_stock <= p.min_stock_level
      ORDER BY (p.min_stock_level - p.quantity_in_stock) DESC, p.name ASC
      LIMIT 1`
  );
  if (worstLow[0] && !worstLow[0].has_login) {
    problems.push(
      `The worst low-stock product (${worstLow[0].sku}) is supplied by ${worstLow[0].supplier}, which has no active supplier login — the demo script would stall at step 4.`
    );
  }

  return problems;
}

async function summarise(client: PoolClient): Promise<void> {
  const { rows } = await client.query<{ label: string; count: number }>(
    `SELECT 'suppliers' AS label, COUNT(*)::int AS count FROM suppliers
     UNION ALL SELECT 'categories', COUNT(*)::int FROM categories
     UNION ALL SELECT 'users', COUNT(*)::int FROM users
     UNION ALL SELECT 'products', COUNT(*)::int FROM products
     UNION ALL SELECT 'low stock', COUNT(*)::int FROM products
        WHERE status = 'active' AND quantity_in_stock <= min_stock_level
     UNION ALL SELECT 'stock movements', COUNT(*)::int FROM stock_movements
     UNION ALL SELECT 'purchase orders', COUNT(*)::int FROM purchase_orders
     UNION ALL SELECT 'purchase order lines', COUNT(*)::int FROM purchase_order_items
     UNION ALL SELECT 'settings', COUNT(*)::int FROM settings`
  );
  for (const row of rows) {
    console.log(`  ${row.label.padEnd(22)} ${row.count}`);
  }

  const { rows: byStatus } = await client.query<{ status: string; count: number }>(
    `SELECT status::text AS status, COUNT(*)::int AS count
       FROM purchase_orders GROUP BY status ORDER BY status`
  );
  console.log(`  orders by status       ${byStatus.map((r) => `${r.status} ${r.count}`).join(' · ')}`);
}

class SeedVerificationError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Seed verification failed:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'SeedVerificationError';
  }
}

async function main(): Promise<void> {
  console.log('[seed] truncating and reloading demo data…');

  await withTransaction(async (client) => {
    await seed(client);
    const problems = await verify(client);
    if (problems.length > 0) throw new SeedVerificationError(problems);
    await summarise(client);
  });

  console.log(`\n[seed] done. Every account uses the password "${env.SEED_PASSWORD}".`);
  console.log(
    '[seed] admin@smartstock.io · staff@smartstock.io · manager@smartstock.io · dana@harbourline.com.au'
  );
}

main()
  .catch((error) => {
    console.error('[seed] failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
