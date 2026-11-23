import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import * as controller from './products.controller';

export const productRoutes = Router();

productRoutes.use(requireAuth);

const READERS = requireRole('admin', 'staff', 'manager');
const WRITERS = requireRole('admin', 'staff');

productRoutes.get('/', READERS, asyncHandler(controller.list));
productRoutes.post('/', WRITERS, asyncHandler(controller.create));

// Declared before '/:id' so these literal paths are not swallowed as ids.
productRoutes.get('/low-stock', READERS, asyncHandler(controller.lowStock));
productRoutes.get('/:id/movements', READERS, asyncHandler(controller.movements));

productRoutes.get('/:id', READERS, asyncHandler(controller.get));
productRoutes.put('/:id', WRITERS, asyncHandler(controller.update));
productRoutes.patch('/:id/status', WRITERS, asyncHandler(controller.setStatus));
