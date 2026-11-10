import { z } from 'zod';
import {
  MOVEMENT_REASONS,
  MOVEMENT_REASON_DIRECTION,
  MOVEMENT_REASON_LABEL,
  MOVEMENT_TYPES,
  NOTE_REQUIRED_REASONS,
  SYSTEM_REASONS,
} from '../domain';
import { dateField, optionalFilter, paginationQuery, positiveInt } from './common';

const optionalText = (max: number) =>
  z.string().trim().max(max, `Must be ${max} characters or fewer`).optional().or(z.literal(''));

/**
 * S11 — a manual stock adjustment.
 *
 * Three rules are checked here rather than in the screen, so a hand-crafted
 * request cannot bypass them:
 *   - `opening_balance` and `po_receipt` are written by the system, never by hand;
 *   - a reason must suit the chosen direction (§3.3);
 *   - `count_correction`, `damaged` and `expired` require a note (§9).
 *
 * The one rule that cannot live here is BR3 — whether the result goes negative
 * depends on the current balance, so it is enforced inside the transaction by
 * movementsService.applyMovement.
 */
export const movementCreateSchema = z
  .object({
    product_id: z.coerce
      .number({ invalid_type_error: 'Select a product' })
      .int()
      .positive('Select a product'),
    type: z.enum(MOVEMENT_TYPES, { invalid_type_error: 'Choose IN or OUT' }),
    reason: z.enum(MOVEMENT_REASONS, { invalid_type_error: 'Choose a reason' }),
    quantity: positiveInt,
    reference: optionalText(60),
    note: optionalText(255),
  })
  .superRefine((data, ctx) => {
    if (SYSTEM_REASONS.includes(data.reason)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: `${MOVEMENT_REASON_LABEL[data.reason]} is recorded by the system, not by hand`,
      });
      return;
    }

    const direction = MOVEMENT_REASON_DIRECTION[data.reason];
    if (direction !== 'BOTH' && direction !== data.type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: `${MOVEMENT_REASON_LABEL[data.reason]} only applies to ${direction} movements`,
      });
    }

    if (NOTE_REQUIRED_REASONS.includes(data.reason) && !data.note?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['note'],
        message: `A note is required for ${MOVEMENT_REASON_LABEL[data.reason].toLowerCase()}`,
      });
    }
  });

export type MovementCreateInput = z.infer<typeof movementCreateSchema>;

export const movementQuerySchema = paginationQuery.extend({
  product_id: optionalFilter(z.coerce.number().int().positive()),
  type: optionalFilter(z.enum(MOVEMENT_TYPES)),
  reason: optionalFilter(z.enum(MOVEMENT_REASONS)),
  user_id: optionalFilter(z.coerce.number().int().positive()),
  date_from: optionalFilter(dateField),
  date_to: optionalFilter(dateField),
});
export type MovementQuery = z.infer<typeof movementQuerySchema>;
