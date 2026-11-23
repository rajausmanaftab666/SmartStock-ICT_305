import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import * as controller from './settings.controller';

export const settingsRoutes = Router();

// Readable by any signed-in user — the shell needs the company name and the
// currency symbol on every screen. Only an administrator changes them.
settingsRoutes.get('/', requireAuth, asyncHandler(controller.get));
settingsRoutes.put('/', requireAuth, requireRole('admin'), asyncHandler(controller.update));
