import { z } from 'zod';
import { MOVEMENT_REASONS, MOVEMENT_TYPES, PO_STATUSES, REPORT_TYPES } from '../domain';
import { dateField, optionalFilter } from './common';

/** §6.9 — every report accepts a date range; the rest are report-specific. */
export const reportQuerySchema = z.object({
  type: z.enum(REPORT_TYPES).default('stock-levels'),
  date_from: optionalFilter(dateField),
  date_to: optionalFilter(dateField),
  category_id: optionalFilter(z.coerce.number().int().positive()),
  supplier_id: optionalFilter(z.coerce.number().int().positive()),
  product_id: optionalFilter(z.coerce.number().int().positive()),
  movement_type: optionalFilter(z.enum(MOVEMENT_TYPES)),
  reason: optionalFilter(z.enum(MOVEMENT_REASONS)),
  status: optionalFilter(z.enum(PO_STATUSES)),
  format: z.enum(['json', 'csv']).default('json'),
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;
