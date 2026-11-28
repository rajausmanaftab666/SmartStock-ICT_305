import type { PoolClient } from 'pg';
import type {
  PoStatus,
  PurchaseOrder,
  PurchaseOrderDetail,
  PurchaseOrderLine,
  PurchaseOrderQuery,
} from '@shared';
import { pool, type Queryable } from '../../config/db';

const SELECT_PO = `
  SELECT po.id,
         po.po_number,
         po.supplier_id,
         s.name           AS supplier_name,
         s.contact_person AS supplier_contact,
         s.email          AS supplier_email,
         s.lead_time_days AS supplier_lead_time_days,
         po.status,
         po.order_date,
         po.expected_date,
         po.total_amount,
         po.notes,
         po.created_by,
         cu.name AS created_by_name,
         po.approved_by,
         au.name AS approved_by_name,
         po.approved_at,
         po.rejection_reason,
         po.submitted_at,
         po.shipped_at,
         po.received_at,
         po.created_at,
         (SELECT COUNT(*)::int FROM purchase_order_items i WHERE i.purchase_order_id = po.id) AS line_count,
         (SELECT COALESCE(SUM(i.quantity), 0)::int FROM purchase_order_items i WHERE i.purchase_order_id = po.id) AS units_ordered,
         (SELECT COALESCE(SUM(i.received_quantity), 0)::int FROM purchase_order_items i WHERE i.purchase_order_id = po.id) AS units_received
    FROM purchase_orders po
    JOIN suppliers s ON s.id = po.supplier_id
    JOIN users    cu ON cu.id = po.created_by
    LEFT JOIN users au ON au.id = po.approved_by
`;

/** Statuses grouped behind the S16 tabs. */
const BUCKETS: Record<string, PoStatus[]> = {
  open: ['draft', 'pending_approval', 'approved', 'shipped', 'partially_received'],
  // Everything finished, however it finished.
  closed: ['received', 'rejected', 'cancelled'],
  // Finished because the goods arrived — a full or partial receipt.
  received: ['received', 'partially_received'],
  // Finished because the order was refused or abandoned. Deliberately separate
  // from `closed`: the S16 tab labelled "Rejected / cancelled" must not also
  // list orders that were successfully received.
  refused: ['rejected', 'cancelled'],
  awaiting_receipt: ['approved', 'shipped', 'partially_received'],
};

export async function list(
  query: PurchaseOrderQuery,
  /**
   * BR11 — when set, the query is confined to this supplier. Passed by the
   * service for supplier users; the filter lives in the SQL, never in the UI.
   */
  scopedSupplierId: number | null,
  db: Queryable = pool
): Promise<{ rows: PurchaseOrder[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (scopedSupplierId !== null) {
    values.push(scopedSupplierId);
    conditions.push(`po.supplier_id = $${values.length}`);
    // A supplier never sees an order that has not been released to them.
    conditions.push(`po.status NOT IN ('draft', 'pending_approval', 'rejected')`);
  } else if (query.supplier_id) {
    values.push(query.supplier_id);
    conditions.push(`po.supplier_id = $${values.length}`);
  }

  if (query.status) {
    values.push(query.status);
    conditions.push(`po.status = $${values.length}`);
  }

  if (query.bucket) {
    values.push(BUCKETS[query.bucket]);
    conditions.push(`po.status = ANY($${values.length}::po_status[])`);
  }

  if (query.date_from) {
    values.push(query.date_from);
    conditions.push(`po.order_date >= $${values.length}::date`);
  }
  if (query.date_to) {
    values.push(query.date_to);
    conditions.push(`po.order_date <= $${values.length}::date`);
  }
  if (query.search) {
    values.push(`%${query.search}%`);
    conditions.push(`(po.po_number ILIKE $${values.length} OR s.name ILIKE $${values.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const totalResult = await db.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
       FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id ${where}`,
    values
  );

  const rowsResult = await db.query<PurchaseOrder>(
    `${SELECT_PO} ${where}
      ORDER BY po.order_date DESC, po.id DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, query.limit, (query.page - 1) * query.limit]
  );

  return { rows: rowsResult.rows, total: totalResult.rows[0].count };
}

export async function findById(id: number, db: Queryable = pool): Promise<PurchaseOrder | null> {
  const result = await db.query<PurchaseOrder>(`${SELECT_PO} WHERE po.id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function findItems(
  purchaseOrderId: number,
  db: Queryable = pool
): Promise<PurchaseOrderLine[]> {
  const result = await db.query<PurchaseOrderLine>(
    `SELECT i.id,
            i.product_id,
            p.sku,
            p.name AS product_name,
            p.unit,
            i.quantity,
            i.received_quantity,
            (i.quantity - i.received_quantity) AS outstanding,
            i.unit_price,
            i.line_total
       FROM purchase_order_items i
       JOIN products p ON p.id = i.product_id
      WHERE i.purchase_order_id = $1
      ORDER BY i.id`,
    [purchaseOrderId]
  );
  return result.rows;
}

export async function findDetail(
  id: number,
  db: Queryable = pool
): Promise<PurchaseOrderDetail | null> {
  const order = await findById(id, db);
  if (!order) return null;
  return { ...order, items: await findItems(id, db) };
}

/**
 * BR13 — the number comes from a dedicated sequence, so it is unique even if
 * two orders are created at the same instant, and it is never reused.
 */
export async function nextPoNumber(prefix: string, db: Queryable = pool): Promise<string> {
  const result = await db.query<{ value: number }>(`SELECT nextval('po_number_seq')::int AS value`);
  return `${prefix}${String(result.rows[0].value).padStart(5, '0')}`;
}

export async function insert(
  client: PoolClient,
  order: {
    poNumber: string;
    supplierId: number;
    orderDate: string;
    expectedDate: string | null;
    notes: string | null;
    createdBy: number;
  }
): Promise<number> {
  const result = await client.query<{ id: number }>(
    `INSERT INTO purchase_orders
       (po_number, supplier_id, status, order_date, expected_date, total_amount, notes, created_by)
     VALUES ($1, $2, 'draft', $3, $4, 0, $5, $6)
     RETURNING id`,
    [order.poNumber, order.supplierId, order.orderDate, order.expectedDate, order.notes, order.createdBy]
  );
  return result.rows[0].id;
}

export async function updateHeader(
  client: PoolClient,
  id: number,
  header: { supplierId: number; expectedDate: string | null; notes: string | null }
): Promise<void> {
  await client.query(
    `UPDATE purchase_orders SET supplier_id = $2, expected_date = $3, notes = $4 WHERE id = $1`,
    [id, header.supplierId, header.expectedDate, header.notes]
  );
}

export async function deleteItems(client: PoolClient, purchaseOrderId: number): Promise<void> {
  await client.query(`DELETE FROM purchase_order_items WHERE purchase_order_id = $1`, [
    purchaseOrderId,
  ]);
}

export async function insertItem(
  client: PoolClient,
  item: {
    purchaseOrderId: number;
    productId: number;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO purchase_order_items
       (purchase_order_id, product_id, quantity, received_quantity, unit_price, line_total)
     VALUES ($1, $2, $3, 0, $4, $5)`,
    [item.purchaseOrderId, item.productId, item.quantity, item.unitPrice, item.lineTotal]
  );
}

/** BR16 — the stored total is always the sum of the lines. */
export async function recalculateTotal(client: PoolClient, id: number): Promise<number> {
  const result = await client.query<{ total: number }>(
    `UPDATE purchase_orders
        SET total_amount = COALESCE(
          (SELECT SUM(line_total) FROM purchase_order_items WHERE purchase_order_id = $1), 0)
      WHERE id = $1
      RETURNING total_amount AS total`,
    [id]
  );
  return result.rows[0].total;
}

export async function remove(id: number, db: Queryable = pool): Promise<boolean> {
  // purchase_order_items cascade on delete.
  const result = await db.query(`DELETE FROM purchase_orders WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function setStatus(
  client: PoolClient,
  id: number,
  status: PoStatus,
  stamps: Partial<{
    submittedAt: boolean;
    approvedBy: number | null;
    approvedAt: boolean;
    rejectionReason: string | null;
    shippedAt: boolean;
    receivedAt: Date | null;
  }> = {}
): Promise<void> {
  const sets: string[] = ['status = $2'];
  const values: unknown[] = [id, status];

  if (stamps.submittedAt) sets.push('submitted_at = NOW()');
  if (stamps.approvedBy !== undefined) {
    values.push(stamps.approvedBy);
    sets.push(`approved_by = $${values.length}`);
  }
  if (stamps.approvedAt) sets.push('approved_at = NOW()');
  if (stamps.rejectionReason !== undefined) {
    values.push(stamps.rejectionReason);
    sets.push(`rejection_reason = $${values.length}`);
  }
  if (stamps.shippedAt) sets.push('shipped_at = NOW()');
  if (stamps.receivedAt !== undefined) {
    values.push(stamps.receivedAt);
    sets.push(`received_at = $${values.length}`);
  }

  await client.query(`UPDATE purchase_orders SET ${sets.join(', ')} WHERE id = $1`, values);
}

/** Locks the order row so two receipts cannot interleave. */
export async function lockOrder(
  client: PoolClient,
  id: number
): Promise<{ id: number; status: PoStatus; po_number: string; supplier_id: number } | null> {
  const result = await client.query<{
    id: number;
    status: PoStatus;
    po_number: string;
    supplier_id: number;
  }>(`SELECT id, status, po_number, supplier_id FROM purchase_orders WHERE id = $1 FOR UPDATE`, [
    id,
  ]);
  return result.rows[0] ?? null;
}

export async function lockItems(
  client: PoolClient,
  purchaseOrderId: number
): Promise<Array<{ id: number; product_id: number; quantity: number; received_quantity: number }>> {
  const result = await client.query<{
    id: number;
    product_id: number;
    quantity: number;
    received_quantity: number;
  }>(
    `SELECT id, product_id, quantity, received_quantity
       FROM purchase_order_items
      WHERE purchase_order_id = $1
      ORDER BY id
      FOR UPDATE`,
    [purchaseOrderId]
  );
  return result.rows;
}

export async function addReceivedQuantity(
  client: PoolClient,
  itemId: number,
  quantity: number
): Promise<void> {
  await client.query(
    `UPDATE purchase_order_items SET received_quantity = received_quantity + $2 WHERE id = $1`,
    [itemId, quantity]
  );
}

export interface LinePricingRow {
  id: number;
  sku: string;
  name: string;
  unit_price: number;
  status: string;
  supplier_id: number;
}

/**
 * Loads the products a set of lines refers to, in one round trip, so the
 * service can check BR7 (right supplier), BR10 (still active) and take the
 * price for BR14 without a query per line.
 */
export async function findSupplierProducts(
  _supplierId: number,
  productIds: number[],
  db: Queryable = pool
): Promise<LinePricingRow[]> {
  if (productIds.length === 0) return [];
  const result = await db.query<LinePricingRow>(
    `SELECT id, sku, name, unit_price, status, supplier_id
       FROM products
      WHERE id = ANY($1::int[])`,
    [productIds]
  );
  return result.rows;
}
