import { z } from 'zod';
import { ENTITY_STATUSES } from '../domain';
import {
  moneyField,
  nameField,
  nonNegativeInt,
  optionalFilter,
  paginationQuery,
  skuField,
} from './common';

/** Query-string booleans arrive as the strings "true"/"false". */
const queryBoolean = z
  .union([z.literal('true'), z.literal('false'), z.boolean()])
  .optional()
  .transform((value) => value === true || value === 'true');

const productBaseSchema = z.object({
  sku: skuField,
  name: nameField,
  description: z.string().trim().max(2000, 'Must be 2000 characters or fewer').optional().or(z.literal('')),
  category_id: z.coerce.number({ invalid_type_error: 'Select a category' }).int().positive('Select a category'),
  supplier_id: z.coerce.number({ invalid_type_error: 'Select a supplier' }).int().positive('Select a supplier'),
  unit: z.string().trim().min(1, 'Unit is required').max(20, 'Must be 20 characters or fewer'),
  unit_price: moneyField,
  min_stock_level: nonNegativeInt,
  status: z.enum(ENTITY_STATUSES).default('active'),
});

/**
 * S8. An opening quantity above zero writes an `opening_balance` movement in
 * the same transaction as the insert — the balance never appears from nowhere.
 */
export const productCreateSchema = productBaseSchema.extend({
  opening_quantity: nonNegativeInt.default(0),
});
export type ProductCreateInput = z.infer<typeof productCreateSchema>;

/**
 * S9. Deliberately has no quantity field of any kind: BR1 means stock only
 * moves through the ledger, so there is nothing here for an edit to change.
 */
export const productUpdateSchema = productBaseSchema;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

export const productStatusSchema = z.object({
  status: z.enum(ENTITY_STATUSES),
});

export const PRODUCT_SORT_KEYS = ['sku', 'name', 'unit_price', 'quantity_in_stock'] as const;
export type ProductSortKey = (typeof PRODUCT_SORT_KEYS)[number];

export const productQuerySchema = paginationQuery.extend({
  category_id: optionalFilter(z.coerce.number().int().positive()),
  supplier_id: optionalFilter(z.coerce.number().int().positive()),
  status: optionalFilter(z.enum(ENTITY_STATUSES)),
  /** BR15 — quantity at or below minimum, active only. */
  low_stock: queryBoolean,
  sort: z.enum(PRODUCT_SORT_KEYS).default('name'),
  direction: z.enum(['asc', 'desc']).default('asc'),
});
export type ProductQuery = z.infer<typeof productQuerySchema>;
