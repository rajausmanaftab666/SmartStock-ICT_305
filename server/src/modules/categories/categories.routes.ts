import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import * as controller from './categories.controller';

export const categoryRoutes = Router();

categoryRoutes.use(requireAuth);

// Readable by everyone who works with the catalogue; only an administrator
// maintains the list itself (§6.4).
categoryRoutes.get('/', requireRole('admin', 'staff', 'manager'), asyncHandler(controller.list));
categoryRoutes.post('/', requireRole('admin'), asyncHandler(controller.create));
categoryRoutes.put('/:id', requireRole('admin'), asyncHandler(controller.update));
categoryRoutes.delete('/:id', requireRole('admin'), asyncHandler(controller.remove));
