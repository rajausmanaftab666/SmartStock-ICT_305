import { z } from 'zod';

/** §9 — category name required and unique. Uniqueness is enforced by the database. */
export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Category name is required')
    .max(100, 'Must be 100 characters or fewer'),
  description: z
    .string()
    .trim()
    .max(255, 'Must be 255 characters or fewer')
    .optional()
    .or(z.literal('')),
});
export type CategoryInput = z.infer<typeof categorySchema>;
