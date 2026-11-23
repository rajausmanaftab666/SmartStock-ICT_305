import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import * as controller from './users.controller';

export const userRoutes = Router();

// User administration is the administrator's alone (§6.2).
userRoutes.use(requireAuth, requireRole('admin'));

userRoutes.get('/', asyncHandler(controller.list));
userRoutes.post('/', asyncHandler(controller.create));
userRoutes.get('/:id', asyncHandler(controller.get));
userRoutes.put('/:id', asyncHandler(controller.update));
userRoutes.patch('/:id/status', asyncHandler(controller.setStatus));
userRoutes.post('/:id/reset-password', asyncHandler(controller.resetPassword));
