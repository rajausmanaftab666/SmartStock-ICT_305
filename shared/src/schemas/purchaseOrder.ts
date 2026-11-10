import { z } from 'zod';
import { PO_STATUSES } from '../domain';
import {
  dateField,
  nonNegativeInt,
  optionalFilter,
  paginationQuery,
  positiveInt,
  rejectionReasonField,
} from './common';

/**
 * A purchase order line as submitted from S15.
 *
 * There is no unit price here on purpose: BR14 was amended at sign-off so the
 * price is copied from the product record when the line is added and is not
 * editable on the order. Staff change prices on the product instead. Orders
 * already raised keep the price they were raised at — that half of BR14 stands.
 */
export const poLineInputSchema = z.object({
  product_id: z.coerce.number().int().positive('Select a product'),
  quantity: positiveInt,
});
export type PoLineInput = z.infer<typeof poLineInputSchema>;

export const purchaseOrderSchema = z.object({
  supplier_id: z.coerce
    .number({ invalid_type_error: 'Select a supplier' })
    .int()
    .positive('Select a supplier'),
  expected_date: dateField.optional().or(z.literal('')),
  notes: z.string().trim().max(500, 'Must be 500 characters or fewer').optional().or(z.literal('')),
  items: z.array(poLineInputSchema).default([]),
});
export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>;

export const rejectSchema = z.object({
  rejection_reason: rejectionReasonField,
});

/** §9 — receiving quantity is a whole number, zero or more, at most outstanding. */
export const receiveLineSchema = z.object({
  item_id: z.coerce.number().int().positive(),
  quantity: nonNegativeInt,
});

export const receiveSchema = z.object({
  reference: z
    .string()
    .trim()
    .min(1, 'A delivery reference is required')
    .max(60, 'Must be 60 characters or fewer'),
  received_date: dateField.optional().or(z.literal('')),
  lines: z.array(receiveLineSchema).min(1, 'Nothing to receive'),
});
export type ReceiveInput = z.infer<typeof receiveSchema>;

export const purchaseOrderQuerySchema = paginationQuery.extend({
  status: optionalFilter(z.enum(PO_STATUSES)),
  supplier_id: optionalFilter(z.coerce.number().int().positive()),
  date_from: optionalFilter(dateField),
  date_to: optionalFilter(dateField),
  /** The S16 tabs group several statuses under one label. */
  bucket: optionalFilter(
    z.enum(['open', 'closed', 'received', 'refused', 'awaiting_receipt'])
  ),
});
export type PurchaseOrderQuery = z.infer<typeof purchaseOrderQuerySchema>;
