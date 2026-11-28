import type {
  AuthUser,
  Paginated,
  PurchaseOrder,
  PurchaseOrderDetail,
  PurchaseOrderInput,
  PurchaseOrderQuery,
  ReceiveInput,
} from '@shared';
import { withTransaction } from '../../config/db';
import { badRequest, conflict, forbidden, notFound } from '../../types/errors';
import { applyMovement } from '../movements/movements.service';
import { getSettings } from '../settings/settings.service';
import * as repo from './purchaseOrders.repo';
import { EDITABLE_STATUSES, RECEIVABLE_STATUSES, assertTransition } from './poTransitions';

/** Today, as the database stores dates. */
function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * BR11 — a supplier user only ever sees their own company's orders, and the
 * restriction is applied in the SQL rather than by hiding anything.
 */
function scopeFor(user: AuthUser): number | null {
  return user.role === 'supplier' ? user.supplier_id : null;
}

export async function list(
  query: PurchaseOrderQuery,
  user: AuthUser
): Promise<Paginated<PurchaseOrder>> {
  const { rows, total } = await repo.list(query, scopeFor(user));
  return { rows, total, page: query.page, limit: query.limit };
}

/**
 * Loads one order and applies BR11. Requesting another supplier's order is a
 * 403, not a 404 — the order exists, this user simply may not see it.
 */
export async function get(id: number, user: AuthUser): Promise<PurchaseOrderDetail> {
  const order = await repo.findDetail(id);
  if (!order) throw notFound('That purchase order does not exist.');

  if (user.role === 'supplier') {
    if (order.supplier_id !== user.supplier_id) {
      throw forbidden('That purchase order belongs to another supplier.');
    }
    // Drafts and orders still awaiting approval have not been released.
    if (['draft', 'pending_approval', 'rejected'].includes(order.status)) {
      throw forbidden('That purchase order has not been released to you.');
    }
  }

  return order;
}

/** Resolves lines to real products and enforces BR7 and BR14. */
async function priceLines(
  supplierId: number,
  items: PurchaseOrderInput['items']
): Promise<Array<{ productId: number; quantity: number; unitPrice: number; lineTotal: number }>> {
  if (items.length === 0) return [];

  const products = await repo.findSupplierProducts(
    supplierId,
    items.map((item) => item.product_id)
  );
  const byId = new Map(products.map((product) => [product.id, product]));

  return items.map((item, index) => {
    const product = byId.get(item.product_id);
    if (!product) {
      throw badRequest('Please correct the highlighted fields.', {
        [`items.${index}.product_id`]: 'That product does not exist',
      });
    }

    // BR7 — every line must belong to the order's supplier.
    if (product.supplier_id !== supplierId) {
      throw badRequest(
        `${product.sku} is supplied by another company. Every line must belong to the order's supplier.`,
        { [`items.${index}.product_id`]: 'Belongs to a different supplier' }
      );
    }

    // BR10 — deactivated products are not offered on new orders.
    if (product.status !== 'active') {
      throw badRequest(`${product.sku} is deactivated and cannot be ordered.`, {
        [`items.${index}.product_id`]: 'This product is deactivated',
      });
    }

    // BR14 — the price is copied from the product record, never sent by the
    // client. Orders already raised keep the price they were raised at.
    const unitPrice = product.unit_price;
    return {
      productId: item.product_id,
      quantity: item.quantity,
      unitPrice,
      lineTotal: round2(item.quantity * unitPrice),
    };
  });
}

function assertExpectedDate(orderDate: string, expected: string | null): void {
  if (expected && expected < orderDate) {
    throw badRequest('Please correct the highlighted fields.', {
      expected_date: 'The expected date cannot be before the order date',
    });
  }
}

export async function create(input: PurchaseOrderInput, user: AuthUser): Promise<PurchaseOrderDetail> {
  const orderDate = today();
  const expectedDate = input.expected_date || null;
  assertExpectedDate(orderDate, expectedDate);

  const lines = await priceLines(input.supplier_id, input.items);
  const settings = await getSettings();

  const id = await withTransaction(async (client) => {
    const poNumber = await repo.nextPoNumber(settings.po_number_prefix, client);
    const orderId = await repo.insert(client, {
      poNumber,
      supplierId: input.supplier_id,
      orderDate,
      expectedDate,
      notes: input.notes || null,
      createdBy: user.id,
    });

    for (const line of lines) {
      await repo.insertItem(client, { purchaseOrderId: orderId, ...line });
    }
    await repo.recalculateTotal(client, orderId);
    return orderId;
  });

  return get(id, user);
}

/**
 * BR5 — the header and lines are editable only while the order is a draft.
 * The whole line set is replaced, which is what S15 sends.
 */
export async function update(
  id: number,
  input: PurchaseOrderInput,
  user: AuthUser
): Promise<PurchaseOrderDetail> {
  const existing = await get(id, user);

  if (!EDITABLE_STATUSES.includes(existing.status)) {
    throw conflict(
      `${existing.po_number} can no longer be edited — only a draft is editable (BR5). It is currently ${existing.status.replace('_', ' ')}.`
    );
  }

  assertExpectedDate(existing.order_date, input.expected_date || null);
  const lines = await priceLines(input.supplier_id, input.items);

  await withTransaction(async (client) => {
    await repo.updateHeader(client, id, {
      supplierId: input.supplier_id,
      expectedDate: input.expected_date || null,
      notes: input.notes || null,
    });
    await repo.deleteItems(client, id);
    for (const line of lines) {
      await repo.insertItem(client, { purchaseOrderId: id, ...line });
    }
    // BR16 — recalculated on every draft save.
    await repo.recalculateTotal(client, id);
  });

  return get(id, user);
}

export async function remove(id: number, user: AuthUser): Promise<void> {
  const existing = await get(id, user);
  if (existing.status !== 'draft') {
    throw conflict(`${existing.po_number} is not a draft, so it cannot be deleted (BR5).`);
  }
  await repo.remove(id);
}

/** BR6 and BR7, then draft → pending_approval. */
export async function submit(id: number, user: AuthUser): Promise<PurchaseOrderDetail> {
  const existing = await get(id, user);
  assertTransition(existing.status, 'pending_approval', existing.po_number);

  if (existing.items.length === 0 || existing.total_amount <= 0) {
    throw badRequest(
      `${existing.po_number} needs at least one line and a total above zero before it can be submitted (BR6).`
    );
  }

  // Re-check BR7 at submit: a product could have changed supplier or been
  // deactivated since the draft was saved. priceLines throws if any line no
  // longer belongs to this order's supplier.
  await priceLines(
    existing.supplier_id,
    existing.items.map((item) => ({ product_id: item.product_id, quantity: item.quantity }))
  );

  await withTransaction((client) =>
    repo.setStatus(client, id, 'pending_approval', { submittedAt: true })
  );

  return get(id, user);
}

/** BR8 — the approver is a manager, and never the person who raised it. */
export async function approve(id: number, user: AuthUser): Promise<PurchaseOrderDetail> {
  const existing = await get(id, user);
  assertTransition(existing.status, 'approved', existing.po_number);

  if (user.role !== 'manager') {
    throw forbidden('Only an operations manager can approve a purchase order.');
  }
  if (existing.created_by === user.id) {
    throw forbidden(
      `${existing.po_number} was raised by you. Approval must come from a different manager (BR8).`
    );
  }

  await withTransaction((client) =>
    repo.setStatus(client, id, 'approved', { approvedBy: user.id, approvedAt: true })
  );

  return get(id, user);
}

export async function reject(
  id: number,
  reason: string,
  user: AuthUser
): Promise<PurchaseOrderDetail> {
  const existing = await get(id, user);
  assertTransition(existing.status, 'rejected', existing.po_number);

  if (user.role !== 'manager') {
    throw forbidden('Only an operations manager can reject a purchase order.');
  }
  if (existing.created_by === user.id) {
    throw forbidden(`${existing.po_number} was raised by you (BR8).`);
  }

  await withTransaction((client) =>
    repo.setStatus(client, id, 'rejected', {
      approvedBy: user.id,
      approvedAt: true,
      rejectionReason: reason,
    })
  );

  return get(id, user);
}

export async function cancel(id: number, user: AuthUser): Promise<PurchaseOrderDetail> {
  const existing = await get(id, user);
  assertTransition(existing.status, 'cancelled', existing.po_number);
  await withTransaction((client) => repo.setStatus(client, id, 'cancelled'));
  return get(id, user);
}

/** BR11 again — a supplier can only ship their own approved order. */
export async function ship(id: number, user: AuthUser): Promise<PurchaseOrderDetail> {
  const existing = await get(id, user);

  if (user.role !== 'supplier' || existing.supplier_id !== user.supplier_id) {
    throw forbidden('Only the supplier this order is addressed to can mark it as shipped.');
  }

  assertTransition(existing.status, 'shipped', existing.po_number);
  await withTransaction((client) => repo.setStatus(client, id, 'shipped', { shippedAt: true }));
  return get(id, user);
}

export interface ReceiptResult {
  order: PurchaseOrderDetail;
  applied: Array<{
    product_name: string;
    sku: string;
    unit: string;
    previous_balance: number;
    balance_after: number;
    quantity: number;
  }>;
  fully_received: boolean;
}

/**
 * §5.6 — goods receipt, in one transaction.
 *
 * Per line: validate BR9, then call the same applyMovement used by manual
 * adjustments, which updates the balance and writes the po_receipt ledger row
 * together (BR1, BR2). After the loop the order lands on `received` or
 * `partially_received` per BR17. Any failure anywhere rolls the whole thing
 * back — no partial receipt, no orphaned movements.
 */
export async function receive(
  id: number,
  input: ReceiveInput,
  user: AuthUser
): Promise<ReceiptResult> {
  const existing = await get(id, user);

  if (!RECEIVABLE_STATUSES.includes(existing.status)) {
    throw conflict(
      `${existing.po_number} cannot be received while it is ${existing.status.replace('_', ' ')}. Stock is only received against an approved, shipped or partially received order (BR17).`
    );
  }

  const requested = input.lines.filter((line) => line.quantity > 0);
  if (requested.length === 0) {
    throw badRequest('Nothing to receive — enter at least one quantity above zero.');
  }

  const result = await withTransaction(async (client) => {
    const order = await repo.lockOrder(client, id);
    if (!order) throw notFound('That purchase order does not exist.');

    // Re-read the status under the lock: another receipt may have completed
    // the order between the check above and this transaction.
    if (!RECEIVABLE_STATUSES.includes(order.status)) {
      throw conflict(`${order.po_number} is no longer open for receipt.`);
    }

    const items = await repo.lockItems(client, id);
    const byId = new Map(items.map((item) => [item.id, item]));
    const applied: ReceiptResult['applied'] = [];

    for (const line of requested) {
      const item = byId.get(line.item_id);
      if (!item) {
        throw badRequest('One of the lines does not belong to this order.', {
          [`lines.${line.item_id}`]: 'Unknown line',
        });
      }

      // BR9 — received_quantity may never exceed quantity.
      const outstanding = item.quantity - item.received_quantity;
      if (line.quantity > outstanding) {
        throw badRequest(
          `Cannot receive ${line.quantity} against a line with only ${outstanding} outstanding (BR9).`,
          { [`lines.${line.item_id}`]: `Cannot exceed the outstanding ${outstanding}` }
        );
      }

      const movement = await applyMovement(client, {
        productId: item.product_id,
        type: 'IN',
        reason: 'po_receipt',
        quantity: line.quantity,
        // §5.6 — the ledger reference is the PO number; the courier's delivery
        // note goes in the note so both are traceable.
        reference: order.po_number,
        note: `Delivery ${input.reference}`,
        userId: user.id,
      });

      await repo.addReceivedQuantity(client, item.id, line.quantity);
      item.received_quantity += line.quantity;

      const product = existing.items.find((candidate) => candidate.id === item.id);
      applied.push({
        product_name: product?.product_name ?? '',
        sku: product?.sku ?? '',
        unit: movement.unit,
        previous_balance: movement.previousBalance,
        balance_after: movement.balanceAfter,
        quantity: line.quantity,
      });
    }

    // BR17 — everything received closes the order, otherwise it is partial.
    const fullyReceived = items.every((item) => item.received_quantity >= item.quantity);
    const nextStatus = fullyReceived ? 'received' : 'partially_received';
    assertTransition(order.status, nextStatus, order.po_number);

    await repo.setStatus(client, id, nextStatus, {
      receivedAt: fullyReceived
        ? input.received_date
          ? new Date(`${input.received_date}T12:00:00`)
          : new Date()
        : null,
    });

    return { applied, fullyReceived };
  });

  return {
    order: await get(id, user),
    applied: result.applied,
    fully_received: result.fullyReceived,
  };
}
