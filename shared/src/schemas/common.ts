import { z } from 'zod';

/**
 * Field-level rules from §9 of the specification. Every module schema is built
 * from these, so a rule is written once and both the browser and the server
 * apply exactly the same test. The server always re-validates — the client's
 * copy is a convenience, never the control.
 */

export const emailField = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .max(150, 'Email must be 150 characters or fewer')
  .email('Enter a valid email address');

export const optionalEmailField = z
  .string()
  .trim()
  .max(150, 'Email must be 150 characters or fewer')
  .email('Enter a valid email address')
  .optional()
  .or(z.literal(''));

export const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be 72 characters or fewer');

export const nameField = z
  .string()
  .trim()
  .min(2, 'Must be at least 2 characters')
  .max(150, 'Must be 150 characters or fewer');

/** SKU: required, unique, alphanumeric with dashes. */
export const skuField = z
  .string()
  .trim()
  .min(1, 'SKU is required')
  .max(50, 'SKU must be 50 characters or fewer')
  .regex(/^[A-Za-z0-9-]+$/, 'Use letters, numbers and dashes only');

/** Money: at least zero, at most two decimal places. */
export const moneyField = z
  .coerce.number({ invalid_type_error: 'Enter a number' })
  .min(0, 'Must be zero or more')
  .refine((value) => Number.isFinite(value) && Math.round(value * 100) === value * 100, {
    message: 'Use at most two decimal places',
  });

export const nonNegativeInt = z.coerce
  .number({ invalid_type_error: 'Enter a whole number' })
  .int('Enter a whole number')
  .min(0, 'Must be zero or more');

export const positiveInt = z.coerce
  .number({ invalid_type_error: 'Enter a whole number' })
  .int('Enter a whole number')
  .min(1, 'Must be at least 1');

export const leadTimeField = z.coerce
  .number({ invalid_type_error: 'Enter a whole number of days' })
  .int('Enter a whole number of days')
  .min(0, 'Must be zero or more')
  .max(365, 'Must be 365 or fewer');

/** An ISO calendar date, as sent by <input type="date">. */
export const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date');

export const rejectionReasonField = z
  .string()
  .trim()
  .min(5, 'A reason of at least 5 characters is required')
  .max(255, 'A reason must be 255 characters or fewer');

/** Shared list query: page, limit and a free-text search term. */
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(150).optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuery>;

/** Treats an empty string or the literal "all" as "no filter applied". */
export function optionalFilter<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) => (value === '' || value === 'all' || value === undefined ? undefined : value),
    schema.optional()
  );
}
