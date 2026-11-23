import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import * as controller from './movements.controller';

export const movementRoutes = Router();

movementRoutes.use(requireAuth);

// Anyone who works with the catalogue can read the ledger…
movementRoutes.get('/', requireRole('admin', 'staff', 'manager'), asyncHandler(controller.list));

// …but only inventory staff record adjustments. Administrators deliberately
// cannot: they set the system up, they do not move stock (§8.1).
movementRoutes.post('/', requireRole('staff'), asyncHandler(controller.create));
