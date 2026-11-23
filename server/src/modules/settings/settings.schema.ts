import { z } from 'zod';
import { nonNegativeInt } from '@shared';

/**
 * §3.2 settings. Values are stored as text in a key/value table; this schema is
 * the one place they are given their real types.
 */
export const settingsSchema = z.object({
  company_name: z.string().trim().min(1, 'Company name is required').max(150),
  currency_symbol: z.string().trim().min(1, 'Currency symbol is required').max(5),
  default_min_stock_level: nonNegativeInt,
  po_number_prefix: z
    .string()
    .trim()
    .min(1, 'A prefix is required')
    .max(10, 'Use 10 characters or fewer')
    .regex(/^[A-Za-z0-9-]+$/, 'Use letters, numbers and dashes only'),
  low_stock_banner_enabled: z.coerce.boolean(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

/** Falls back to the §3.2 defaults when a key is missing from the table. */
export const SETTING_DEFAULTS: Record<string, string> = {
  company_name: 'SmartStock Distribution',
  currency_symbol: '$',
  default_min_stock_level: '10',
  po_number_prefix: 'PO-',
  low_stock_banner_enabled: 'true',
};
