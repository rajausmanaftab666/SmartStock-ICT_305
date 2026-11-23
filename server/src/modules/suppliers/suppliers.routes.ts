import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import * as controller from './suppliers.controller';

export const supplierRoutes = Router();

supplierRoutes.use(requireAuth);

/**
 * Suppliers are administrator-owned — a signed-off change to §6.3, made as a
 * segregation-of-duties control. Staff and managers still read the list
 * because they need contacts and lead times to raise and review orders, but
 * only an administrator can create, amend or deactivate a supplier record.
 */
supplierRoutes.get('/', requireRole('admin', 'staff', 'manager'), asyncHandler(controller.list));
supplierRoutes.get('/:id', requireRole('admin', 'staff', 'manager'), asyncHandler(controller.get));

supplierRoutes.post('/', requireRole('admin'), asyncHandler(controller.create));
supplierRoutes.put('/:id', requireRole('admin'), asyncHandler(controller.update));
supplierRoutes.patch('/:id/status', requireRole('admin'), asyncHandler(controller.setStatus));
