import { z } from 'zod';

export { categorySchema } from '@shared';
export type { CategoryInput } from '@shared';

/** Route parameters are user input too. */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid identifier'),
});
