import type { PoolClient } from 'pg';
import type {
  MovementCreateInput,
  MovementQuery,
  MovementReason,
  MovementType,
  Paginated,
  Product,
  StockMovement,
} from '@shared';
import { MOVEMENT_REASON_LABEL } from '@shared';
import { withTransaction } from '../../config/db';
import { badRequest, notFound } from '../../types/errors';
import * as productsRepo from '../products/products.repo';
import * as repo from './movements.repo';

/**
 * BR1 lives here, and only here.
 *
 * `products.quantity_in_stock` is never modified anywhere else in this
 * codebase: manual adjustments (S11) and goods receipt (S18) both call
 * applyMovement, so there is exactly one code path that can move a balance and
 * it always writes the matching ledger row in the same transaction.
 *
 * A controller must never write the update itself. If a future feature needs
 * to change stock, it calls this.
 */

export interface ApplyMovementInput {
  productId: number;
  type: MovementType;
  reason: MovementReason;
  /** Always a positive magnitude — the sign comes from `type`. */
  quantity: number;
  reference?: string | null;
  note?: string | null;
  userId: number;
}

export interface AppliedMovement {
  movementId: number;
  productId: number;
  previousBalance: number;
  quantityChange: number;
  balanceAfter: number;
  unit: string;
  /** True when the new balance sits at or below the minimum level (BR15). */
  isLowAfter: boolean;
}

/**
 * Applies one movement inside the caller's transaction.
 *
 * The client argument is mandatory and is not optional by accident: taking a
 * transaction rather than the pool is what guarantees the balance update and
 * the ledger insert commit or roll back together.
 */
export async function applyMovement(
  client: PoolClient,
  input: ApplyMovementInput
): Promise<AppliedMovement> {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw badRequest('Please correct the highlighted fields.', {
      quantity: 'Enter a whole number of at least 1',
    });
  }

  // Locks the row for the rest of the transaction.
  const product = await repo.lockProductBalance(client, input.productId);
  if (!product) throw notFound('That product does not exist.');

  // BR2 — IN is positive, OUT is negative, and balance_after is the running total.
  const quantityChange = input.type === 'IN' ? input.quantity : -input.quantity;
  const previousBalance = product.quantity_in_stock;
  const balanceAfter = previousBalance + quantityChange;

  // BR3 — a movement may never drive the balance below zero. Throwing here
  // rolls the whole transaction back, so nothing at all is written.
  if (balanceAfter < 0) {
    throw badRequest(
      `That would take stock to ${balanceAfter}. A movement can never drive a balance below zero — there are only ${previousBalance} ${product.unit} on hand.`,
      { quantity: `At most ${previousBalance} can be removed` }
    );
  }

  await repo.setBalance(client, input.productId, balanceAfter);

  const movementId = await repo.insert(client, {
    productId: input.productId,
    type: input.type,
    reason: input.reason,
    quantityChange,
    balanceAfter,
    reference: input.reference?.trim() ? input.reference.trim() : null,
    note: input.note?.trim() ? input.note.trim() : null,
    userId: input.userId,
  });

  return {
    movementId,
    productId: input.productId,
    previousBalance,
    quantityChange,
    balanceAfter,
    unit: product.unit,
    isLowAfter: balanceAfter <= product.min_stock_level,
  };
}

/**
 * S11 — records one manual adjustment. The transaction wraps applyMovement, so
 * a rejected movement (BR3) leaves the database exactly as it was.
 */
export async function recordManual(
  input: MovementCreateInput,
  userId: number
): Promise<AppliedMovement & { product: Product }> {
  const applied = await withTransaction((client) =>
    applyMovement(client, {
      productId: input.product_id,
      type: input.type,
      reason: input.reason,
      quantity: input.quantity,
      reference: input.reference ?? null,
      note: input.note ?? null,
      userId,
    })
  );

  return { ...applied, product: await productsRepo.findById(input.product_id) as Product };
}

export async function list(query: MovementQuery): Promise<Paginated<StockMovement>> {
  const { rows, total } = await repo.list(query);
  return { rows, total, page: query.page, limit: query.limit };
}

export async function listForProduct(
  productId: number,
  page: number,
  limit: number
): Promise<Paginated<StockMovement>> {
  const { rows, total } = await repo.findByProduct(productId, page, limit);
  return { rows, total, page, limit };
}

export function recent(limit = 5): Promise<StockMovement[]> {
  return repo.findRecent(limit);
}

export function describeReason(reason: MovementReason): string {
  return MOVEMENT_REASON_LABEL[reason];
}
