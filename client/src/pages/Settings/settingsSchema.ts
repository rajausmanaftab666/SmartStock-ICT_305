import { z } from 'zod';
import { nonNegativeInt } from '@shared';

/**
 * The client-side copy of the settings rules. It mirrors the server's schema
 * exactly; the server is still the control, this only saves a round trip.
 */
export const settingsSchemaShape = z.object({
  company_name: z.string().trim().min(1, 'Company name is required').max(150),
  currency_symbol: z.string().trim().min(1, 'Currency symbol is required').max(5),
  default_min_stock_level: nonNegativeInt,
  po_number_prefix: z
    .string()
    .trim()
    .min(1, 'A prefix is required')
    .max(10, 'Use 10 characters or fewer')
    .regex(/^[A-Za-z0-9-]+$/, 'Use letters, numbers and dashes only'),
  low_stock_banner_enabled: z.boolean(),
});
