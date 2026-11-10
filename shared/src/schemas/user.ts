import { z } from 'zod';
import { ENTITY_STATUSES, ROLES } from '../domain';
import { emailField, nameField, optionalFilter, paginationQuery, passwordField } from './common';

/**
 * BR18 — a supplier user is linked to exactly one supplier company, and every
 * other role must not carry a link at all. Checked here, again in the service,
 * and finally by a CHECK constraint on the table.
 */
function applySupplierLinkRule(
  data: { role: string; supplier_id?: number | null },
  ctx: z.RefinementCtx
): void {
  if (data.role === 'supplier' && !data.supplier_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['supplier_id'],
      message: 'A supplier user must be linked to a supplier company',
    });
  }
  if (data.role !== 'supplier' && data.supplier_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['supplier_id'],
      message: 'Only a supplier user can be linked to a supplier company',
    });
  }
}

const supplierLink = z.preprocess(
  (value) => (value === '' || value === undefined || value === null ? null : Number(value)),
  z.number().int().positive().nullable()
);

const userBase = {
  name: nameField,
  email: emailField,
  role: z.enum(ROLES, { invalid_type_error: 'Choose a role' }),
  supplier_id: supplierLink,
  status: z.enum(ENTITY_STATUSES).default('active'),
};

export const userCreateSchema = z
  .object({
    ...userBase,
    password: passwordField,
    confirm_password: z.string().min(1, 'Confirm the password'),
  })
  .superRefine((data, ctx) => {
    applySupplierLinkRule(data, ctx);
    if (data.password !== data.confirm_password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirm_password'],
        message: 'The two passwords do not match',
      });
    }
  });
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object(userBase).superRefine(applySupplierLinkRule);
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const userStatusSchema = z.object({ status: z.enum(ENTITY_STATUSES) });

export const resetPasswordSchema = z.object({ new_password: passwordField });

export const userQuerySchema = paginationQuery.extend({
  role: optionalFilter(z.enum(ROLES)),
  status: optionalFilter(z.enum(ENTITY_STATUSES)),
});
export type UserQuery = z.infer<typeof userQuerySchema>;
