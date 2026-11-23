import type {
  MovementQuery,
  MovementReason,
  MovementType,
  StockMovement,
} from "@shared";
import { pool, type Queryable } from "../../config/db";
import type { PoolClient } from "pg";

const SELECT_MOVEMENT = `
  SELECT m.id,
         m.product_id,
         p.sku  AS product_sku,
         p.name AS product_name,
         m.type,
         m.reason,
         m.quantity_change,
         m.balance_after,
         m.reference,
         m.note,
         m.user_id,
         u.name AS user_name,
         m.created_at
    FROM stock_movements m
    JOIN products p ON p.id = m.product_id
    JOIN users u    ON u.id = m.user_id
`;

/**
 * Locks the product row for the rest of the transaction and returns its
 * current balance.
 *
 * The lock is what makes BR1 safe under concurrency: two simultaneous
 * movements against the same product would otherwise both read the same
 * starting balance and one would overwrite the other, leaving the ledger and
 * the stored quantity permanently out of step.
 */
export async function lockProductBalance(
  client: PoolClient,
  productId: number,
): Promise<{
  quantity_in_stock: number;
  min_stock_level: number;
  unit: string;
} | null> {
  const result = await client.query<{
    quantity_in_stock: number;
    min_stock_level: number;
    unit: string;
  }>(
    `SELECT quantity_in_stock, min_stock_level, unit
       FROM products
      WHERE id = $1
      FOR UPDATE`,
    [productId],
  );
  return result.rows[0] ?? null;
}

export async function setBalance(
  client: PoolClient,
  productId: number,
  balance: number,
): Promise<void> {
  await client.query(
    `UPDATE products SET quantity_in_stock = $2 WHERE id = $1`,
    [productId, balance],
  );
}

export async function insert(
  client: PoolClient,
  movement: {
    productId: number;
    type: MovementType;
    reason: MovementReason;
    quantityChange: number;
    balanceAfter: number;
    reference: string | null;
    note: string | null;
    userId: number;
  },
): Promise<number> {
  const result = await client.query<{ id: number }>(
    `INSERT INTO stock_movements
       (product_id, type, reason, quantity_change, balance_after, reference, note, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      movement.productId,
      movement.type,
      movement.reason,
      movement.quantityChange,
      movement.balanceAfter,
      movement.reference,
      movement.note,
      movement.userId,
    ],
  );
  return result.rows[0].id;
}

export async function findByProduct(
  productId: number,
  page: number,
  limit: number,
  db: Queryable = pool,
): Promise<{ rows: StockMovement[]; total: number }> {
  const totalResult = await db.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM stock_movements WHERE product_id = $1`,
    [productId],
  );

  const rowsResult = await db.query<StockMovement>(
    `${SELECT_MOVEMENT}
      WHERE m.product_id = $1
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT $2 OFFSET $3`,
    [productId, limit, (page - 1) * limit],
  );

  return { rows: rowsResult.rows, total: totalResult.rows[0].count };
}

/** 6.6 — the cross-catalogue movement list, with every filter it accepts. */
export async function list(
  query: MovementQuery,
  db: Queryable = pool,
): Promise<{ rows: StockMovement[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (query.product_id) {
    values.push(query.product_id);
    conditions.push(`m.product_id = $${values.length}`);
  }
  if (query.type) {
    values.push(query.type);
    conditions.push(`m.type = $${values.length}`);
  }
  if (query.reason) {
    values.push(query.reason);
    conditions.push(`m.reason = $${values.length}`);
  }
  if (query.user_id) {
    values.push(query.user_id);
    conditions.push(`m.user_id = $${values.length}`);
  }
  if (query.date_from) {
    values.push(query.date_from);
    conditions.push(`m.created_at >= $${values.length}::date`);
  }
  if (query.date_to) {
    // Inclusive of the whole end day.
    values.push(query.date_to);
    conditions.push(
      `m.created_at < ($${values.length}::date + INTERVAL '1 day')`,
    );
  }
  if (query.search) {
    values.push(`%${query.search}%`);
    conditions.push(
      `(p.name ILIKE $${values.length} OR p.sku ILIKE $${values.length} OR m.reference ILIKE $${values.length})`,
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const totalResult = await db.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
       FROM stock_movements m JOIN products p ON p.id = m.product_id ${where}`,
    values,
  );

  const rowsResult = await db.query<StockMovement>(
    `${SELECT_MOVEMENT} ${where}
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, query.limit, (query.page - 1) * query.limit],
  );

  return { rows: rowsResult.rows, total: totalResult.rows[0].count };
}

/** The five most recent movements across the whole catalogue (dashboards). */
export async function findRecent(
  limit: number,
  db: Queryable = pool,
): Promise<StockMovement[]> {
  const result = await db.query<StockMovement>(
    `${SELECT_MOVEMENT} ORDER BY m.created_at DESC, m.id DESC LIMIT $1`,
    [limit],
  );
  return result.rows;
}
