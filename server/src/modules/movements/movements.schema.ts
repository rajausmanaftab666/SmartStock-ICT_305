import { z } from 'zod';

export { movementCreateSchema, movementQuerySchema } from '@shared';
export type { MovementCreateInput, MovementQuery } from '@shared';

/** The page size used by a product's own history table. */
export const movementPageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type MovementPageQuery = z.infer<typeof movementPageSchema>;
