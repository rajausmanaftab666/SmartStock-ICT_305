import type {
  EntityStatus,
  Supplier,
  SupplierInput,
  SupplierOrderSummary,
  SupplierProductSummary,
  SupplierQuery,
} from '@shared';
import { pool, type Queryable } from '../../config/db';

/**
 * A supplier row always arrives with the two counts S13 shows. They are
 * correlated subqueries rather than joins so a supplier with no products and
 * no orders still returns one row with zeroes.
 *
 * "Open" deliberately excludes received, cancelled and rejected orders — those
 * need no further action from anybody.
 */
const SELECT_SUPPLIER = `
  SELECT s.id,
         s.name,
         s.contact_person,
         s.email,
         s.phone,
         s.address,
         s.lead_time_days,
         s.status,
         (SELECT COUNT(*)::int FROM products p WHERE p.supplier_id = s.id) AS product_count,
         (SELECT COUNT(*)::int FROM purchase_orders po
           WHERE po.supplier_id = s.id
             AND po.status NOT IN ('received', 'cancelled', 'rejected')) AS open_order_count
    FROM suppliers s
`;

/**
 * Sort keys are mapped to fixed SQL, never interpolated. The zod schema
 * already restricts them to a known set; this is the second lock.
 */
const SORT_COLUMNS: Record<SupplierQuery['sort'], string> = {
  name: 's.name',
  lead_time_days: 's.lead_time_days',
  status: 's.status',
};

interface ListResult {
  rows: Supplier[];
  total: number;
}

export async function list(query: SupplierQuery, db: Queryable = pool): Promise<ListResult> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (query.search) {
    values.push(`%${query.search}%`);
    conditions.push(
      `(s.name ILIKE $${values.length} OR s.contact_person ILIKE $${values.length} OR s.email ILIKE $${values.length})`
    );
  }

  if (query.status) {
    values.push(query.status);
    conditions.push(`s.status = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const direction = query.direction === 'desc' ? 'DESC' : 'ASC';
  const orderBy = `${SORT_COLUMNS[query.sort]} ${direction}, s.id ASC`;

  const totalResult = await db.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM suppliers s ${where}`,
    values
  );

  const offset = (query.page - 1) * query.limit;
  const rowsResult = await db.query<Supplier>(
    `${SELECT_SUPPLIER} ${where} ORDER BY ${orderBy} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, query.limit, offset]
  );

  return { rows: rowsResult.rows, total: totalResult.rows[0].count };
}

export async function findById(id: number, db: Queryable = pool): Promise<Supplier | null> {
  const result = await db.query<Supplier>(`${SELECT_SUPPLIER} WHERE s.id = $1`, [id]);
  return result.rows[0] ?? null;
}

/** Everything this supplier supplies — the read-only panel on S14. */
export async function findProducts(
  supplierId: number,
  db: Queryable = pool
): Promise<SupplierProductSummary[]> {
  const result = await db.query<SupplierProductSummary>(
    `SELECT id, sku, name, unit, quantity_in_stock, min_stock_level, status
       FROM products
      WHERE supplier_id = $1
      ORDER BY name`,
    [supplierId]
  );
  return result.rows;
}

export async function findRecentOrders(
  supplierId: number,
  limit = 5,
  db: Queryable = pool
): Promise<SupplierOrderSummary[]> {
  const result = await db.query<SupplierOrderSummary>(
    `SELECT id, po_number, status, order_date, total_amount
       FROM purchase_orders
      WHERE supplier_id = $1
      ORDER BY order_date DESC, id DESC
      LIMIT $2`,
    [supplierId, limit]
  );
  return result.rows;
}

export async function insert(input: SupplierInput, db: Queryable = pool): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO suppliers (name, contact_person, email, phone, address, lead_time_days, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      input.name,
      input.contact_person || null,
      input.email || null,
      input.phone || null,
      input.address || null,
      input.lead_time_days,
      input.status,
    ]
  );
  return result.rows[0].id;
}

export async function update(
  id: number,
  input: SupplierInput,
  db: Queryable = pool
): Promise<boolean> {
  const result = await db.query(
    `UPDATE suppliers
        SET name = $2, contact_person = $3, email = $4, phone = $5,
            address = $6, lead_time_days = $7, status = $8
      WHERE id = $1`,
    [
      id,
      input.name,
      input.contact_person || null,
      input.email || null,
      input.phone || null,
      input.address || null,
      input.lead_time_days,
      input.status,
    ]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateStatus(
  id: number,
  status: EntityStatus,
  db: Queryable = pool
): Promise<boolean> {
  const result = await db.query(`UPDATE suppliers SET status = $2 WHERE id = $1`, [id, status]);
  return (result.rowCount ?? 0) > 0;
}
