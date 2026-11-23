import type {
  EntityStatus,
  LowStockItem,
  Paginated,
  Product,
  ProductCreateInput,
  ProductQuery,
  ProductUpdateInput,
  StockMovement,
} from '@shared';
import { withTransaction } from '../../config/db';
import { badRequest, notFound } from '../../types/errors';
import { isUniqueViolation } from '../../types/pg';
import * as movementsService from '../movements/movements.service';
import * as repo from './products.repo';

const DUPLICATE_SKU = { sku: 'A product with that SKU already exists' };

export async function list(query: ProductQuery): Promise<Paginated<Product>> {
  const { rows, total } = await repo.list(query);
  return { rows, total, page: query.page, limit: query.limit };
}

export async function get(id: number): Promise<Product> {
  const product = await repo.findById(id);
  if (!product) throw notFound('That product does not exist.');
  return product;
}

/** Category and supplier are foreign keys; check them before the insert so the
 *  failure lands on the right field rather than as a database error. */
async function assertReferencesExist(input: {
  category_id: number;
  supplier_id: number;
}): Promise<void> {
  const fields: Record<string, string> = {};

  if (!(await repo.categoryExists(input.category_id))) {
    fields.category_id = 'Select a category that exists';
  }
  if ((await repo.supplierIsActive(input.supplier_id)) === null) {
    fields.supplier_id = 'Select a supplier that exists';
  }

  if (Object.keys(fields).length > 0) {
    throw badRequest('Please correct the highlighted fields.', fields);
  }
}

/**
 * S8. The insert and the opening balance movement share one transaction: if
 * the movement fails, the product is never created either. That is BR1 applied
 * from the very first unit of stock.
 */
export async function create(input: ProductCreateInput, userId: number): Promise<Product> {
  await assertReferencesExist(input);

  const id = await withTransaction(async (client) => {
    let productId: number;
    try {
      productId = await repo.insert(input, userId, client);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw badRequest('Please correct the highlighted fields.', DUPLICATE_SKU);
      }
      throw error;
    }

    if (input.opening_quantity > 0) {
      await movementsService.applyMovement(client, {
        productId,
        type: 'IN',
        reason: 'opening_balance',
        quantity: input.opening_quantity,
        reference: null,
        note: 'Opening balance recorded when the product was created.',
        userId,
      });
    }

    return productId;
  });

  return get(id);
}

/** S9. Cannot change the balance — there is no quantity field to change. */
export async function update(
  id: number,
  input: ProductUpdateInput,
  userId: number
): Promise<Product> {
  await get(id);
  await assertReferencesExist(input);

  try {
    await repo.update(id, input, userId);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw badRequest('Please correct the highlighted fields.', DUPLICATE_SKU);
    }
    throw error;
  }

  return get(id);
}

/**
 * BR10 — products are deactivated, never deleted. An inactive product drops
 * out of purchase order pickers but keeps its ledger and its order history.
 */
export async function setStatus(
  id: number,
  status: EntityStatus,
  userId: number
): Promise<Product> {
  await get(id);
  await repo.updateStatus(id, status, userId);
  return get(id);
}

/** BR15, computed live. Every consumer — badge, banner, alerts page, report —
 *  runs this same query rather than reading a stored flag. */
export function lowStock(supplierId?: number): Promise<LowStockItem[]> {
  return repo.findLowStock(supplierId);
}

export function lowStockCount(): Promise<number> {
  return repo.countLowStock();
}

export async function movements(
  productId: number,
  page: number,
  limit: number
): Promise<Paginated<StockMovement>> {
  await get(productId);
  return movementsService.listForProduct(productId, page, limit);
}
