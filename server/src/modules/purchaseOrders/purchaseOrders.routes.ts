import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import * as controller from './purchaseOrders.controller';

export const purchaseOrderRoutes = Router();

purchaseOrderRoutes.use(requireAuth);

// All four roles can read; supplier users are confined to their own company's
// orders inside the query itself (BR11), never by hiding rows afterwards.
purchaseOrderRoutes.get(
  '/',
  requireRole('admin', 'staff', 'manager', 'supplier'),
  asyncHandler(controller.list)
);
purchaseOrderRoutes.get(
  '/:id',
  requireRole('admin', 'staff', 'manager', 'supplier'),
  asyncHandler(controller.get)
);

// Raising, editing and receiving is inventory staff's job.
purchaseOrderRoutes.post('/', requireRole('staff'), asyncHandler(controller.create));
purchaseOrderRoutes.put('/:id', requireRole('staff'), asyncHandler(controller.update));
purchaseOrderRoutes.delete('/:id', requireRole('staff'), asyncHandler(controller.remove));
purchaseOrderRoutes.post('/:id/submit', requireRole('staff'), asyncHandler(controller.submit));
purchaseOrderRoutes.post('/:id/cancel', requireRole('staff'), asyncHandler(controller.cancel));
purchaseOrderRoutes.post('/:id/receive', requireRole('staff'), asyncHandler(controller.receive));

// Approval is the manager's, and only the manager's (segregation of duties).
purchaseOrderRoutes.post('/:id/approve', requireRole('manager'), asyncHandler(controller.approve));
purchaseOrderRoutes.post('/:id/reject', requireRole('manager'), asyncHandler(controller.reject));

// Shipping is the supplier's single action.
purchaseOrderRoutes.post('/:id/ship', requireRole('supplier'), asyncHandler(controller.ship));
