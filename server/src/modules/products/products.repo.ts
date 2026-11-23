import type {
  EntityStatus,
  LowStockItem,
  Product,
  ProductCreateInput,
  ProductQuery,
  ProductUpdateInput,
} from '@shared';
import { pool, type Queryable } from '../../config/db';

/**
 * `is_low` is computed on read (BR15) rather than stored. There is no
 * notifications table and no flag to keep in step — every consumer runs the
 * same condition.
 */
const SELECT_PRODUCT = `
  SELECT p.id,
         p.sku,
         p.name,
         p.description,
         p.category_id,
         c.name AS category_name,
         p.supplier_id,
         s.name AS supplier_name,
         p.unit,
         p.unit_price,
         p.quantity_in_stock,
         p.min_stock_level,
         p.status,
         p.created_by,
         cu.name AS created_by_name,
         p.updated_by,
         uu.name AS updated_by_name,
         p.created_at,
         p.updated_at,
         (p.status = 'active' AND p.quantity_in_stock <= p.min_stock_level) AS is_low
    FROM products p
    JOIN categories c ON c.id = p.category_id
    JOIN suppliers  s ON s.id = p.supplier_id
    JOIN users     cu ON cu.id = p.created_by
    LEFT JOIN users uu ON uu.id = p.updated_by
`;

/** Sort keys map to fixed SQL; user input is never interpolated. */
const SORT_COLUMNS: Record<ProductQuery['sort'], string> = {
  sku: 'p.sku',
  name: 'p.name',
  unit_price: 'p.unit_price',
  quantity_in_stock: 'p.quantity_in_stock',
};

export async function list(
  query: ProductQuery,
  db: Queryable = pool
): Promise<{ rows: Product[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (query.search) {
    values.push(`%${query.search}%`);
    conditions.push(`(p.name ILIKE $${values.length} OR p.sku ILIKE $${values.length})`);
  }

  if (query.category_id) {
    values.push(query.category_id);
    conditions.push(`p.category_id = $${values.length}`);
  }

  if (query.supplier_id) {
    values.push(query.supplier_id);
    conditions.push(`p.supplier_id = $${values.length}`);
  }

  if (query.status) {
    values.push(query.status);
    conditions.push(`p.status = $${values.length}`);
  }

  // BR15 — the "Low stock only" option on S7.
  if (query.low_stock) {
    conditions.push(`(p.status = 'active' AND p.quantity_in_stock <= p.min_stock_level)`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const direction = query.direction === 'desc' ? 'DESC' : 'ASC';
  const orderBy = `${SORT_COLUMNS[query.sort]} ${direction}, p.id ASC`;

  const totalResult = await db.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM products p ${where}`,
    values
  );

  const rowsResult = await db.query<Product>(
    `${SELECT_PRODUCT} ${where} ORDER BY ${orderBy} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, query.limit, (query.page - 1) * query.limit]
  );

  return { rows: rowsResult.rows, total: totalResult.rows[0].count };
}

export async function findById(id: number, db: Queryable = pool): Promise<Product | null> {
  const result = await db.query<Product>(`${SELECT_PRODUCT} WHERE p.id = $1`, [id]);
  return result.rows[0] ?? null;
}

/**
 * Products are always inserted with a zero balance. Any opening quantity is
 * applied afterwards through movementsService.applyMovement, so even a brand
 * new product's stock is backed by a ledger row (BR1).
 */
export async function insert(
  input: ProductCreateInput,
  userId: number,
  db: Queryable = pool
): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO products
       (sku, name, description, category_id, supplier_id, unit, unit_price,
        quantity_in_stock, min_stock_level, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10)
     RETURNING id`,
    [
      input.sku,
      input.name,
      input.description || null,
      input.category_id,
      input.supplier_id,
      input.unit,
      input.unit_price,
      input.min_stock_level,
      input.status,
      userId,
    ]
  );
  return result.rows[0].id;
}

/**
 * Note what is absent: quantity_in_stock. An edit can change anything about a
 * product except how much of it there is (BR1, and the visible face of it on
 * S9).
 */
export async function update(
  id: number,
  input: ProductUpdateInput,
  userId: number,
  db: Queryable = pool
): Promise<boolean> {
  const result = await db.query(
    `UPDATE products
        SET sku = $2, name = $3, description = $4, category_id = $5, supplier_id = $6,
            unit = $7, unit_price = $8, min_stock_level = $9, status = $10, updated_by = $11
      WHERE id = $1`,
    [
      id,
      input.sku,
      input.name,
      input.description || null,
      input.category_id,
      input.supplier_id,
      input.unit,
      input.unit_price,
      input.min_stock_level,
      input.status,
      userId,
    ]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateStatus(
  id: number,
  status: EntityStatus,
  userId: number,
  db: Queryable = pool
): Promise<boolean> {
  const result = await db.query(
    `UPDATE products SET status = $2, updated_by = $3 WHERE id = $1`,
    [id, status, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * BR15 — every product at or below its minimum, worst shortfall first.
 *
 * `last_received_at` comes from the ledger rather than a stored column: the
 * most recent po_receipt movement is by definition the last delivery.
 */
export async function findLowStock(
  supplierId: number | undefined,
  db: Queryable = pool
): Promise<LowStockItem[]> {
  const values: unknown[] = [];
  let supplierFilter = '';

  if (supplierId) {
    values.push(supplierId);
    supplierFilter = `AND p.supplier_id = $${values.length}`;
  }

  const result = await db.query<LowStockItem>(
    `SELECT p.id,
            p.sku,
            p.name,
            p.unit,
            p.unit_price,
            p.supplier_id,
            s.name AS supplier_name,
            p.quantity_in_stock,
            p.min_stock_level,
            (p.min_stock_level - p.quantity_in_stock) AS shortfall,
            GREATEST(p.min_stock_level * 2 - p.quantity_in_stock, 1) AS suggested_order_quantity,
            (SELECT MAX(m.created_at) FROM stock_movements m
              WHERE m.product_id = p.id AND m.reason = 'po_receipt') AS last_received_at
       FROM products p
       JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.status = 'active'
        AND p.quantity_in_stock <= p.min_stock_level
        ${supplierFilter}
      ORDER BY (p.min_stock_level - p.quantity_in_stock) DESC, p.name ASC`,
    values
  );
  return result.rows;
}

export async function countLowStock(db: Queryable = pool): Promise<number> {
  const result = await db.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
       FROM products
      WHERE status = 'active' AND quantity_in_stock <= min_stock_level`
  );
  return result.rows[0].count;
}

export async function categoryExists(id: number, db: Queryable = pool): Promise<boolean> {
  const result = await db.query(`SELECT 1 FROM categories WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function supplierIsActive(id: number, db: Queryable = pool): Promise<boolean | null> {
  const result = await db.query<{ status: EntityStatus }>(
    `SELECT status FROM suppliers WHERE id = $1`,
    [id]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0].status === 'active';
}
