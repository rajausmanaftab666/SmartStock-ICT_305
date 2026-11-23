export {
  productCreateSchema,
  productUpdateSchema,
  productQuerySchema,
  productStatusSchema,
} from '@shared';
export type { ProductCreateInput, ProductUpdateInput, ProductQuery } from '@shared';
export { idParamSchema } from '../categories/categories.schema';
export { movementPageSchema } from '../movements/movements.schema';

import { z } from 'zod';
import { optionalFilter } from '@shared';

/** S12 filters the alerts list by supplier. */
export const lowStockQuerySchema = z.object({
  supplier_id: optionalFilter(z.coerce.number().int().positive()),
});
