import type {
  EntityStatus,
  Paginated,
  Supplier,
  SupplierDetail,
  SupplierInput,
  SupplierQuery,
} from '@shared';
import { notFound } from '../../types/errors';
import * as repo from './suppliers.repo';

export async function list(query: SupplierQuery): Promise<Paginated<Supplier>> {
  const { rows, total } = await repo.list(query);
  return { rows, total, page: query.page, limit: query.limit };
}

export async function get(id: number): Promise<Supplier> {
  const supplier = await repo.findById(id);
  if (!supplier) throw notFound('That supplier does not exist.');
  return supplier;
}

/**
 * The detail view carries the two read-only panels S14 shows on edit: what
 * this supplier supplies, and their five most recent orders.
 */
export async function getDetail(id: number): Promise<SupplierDetail> {
  const supplier = await get(id);
  const [products, recentOrders] = await Promise.all([
    repo.findProducts(id),
    repo.findRecentOrders(id),
  ]);
  return { ...supplier, products, recent_orders: recentOrders };
}

export async function create(input: SupplierInput): Promise<Supplier> {
  const id = await repo.insert(input);
  return get(id);
}

export async function update(id: number, input: SupplierInput): Promise<Supplier> {
  await get(id);
  await repo.update(id, input);
  return get(id);
}

/**
 * BR10 — suppliers are deactivated, never deleted. An inactive supplier keeps
 * its products and its order history; it simply stops being offered when a new
 * order or product is created.
 */
export async function setStatus(id: number, status: EntityStatus): Promise<Supplier> {
  await get(id);
  await repo.updateStatus(id, status);
  return get(id);
}
