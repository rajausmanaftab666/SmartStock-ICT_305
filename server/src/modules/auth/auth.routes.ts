import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireAuth } from '../../middleware/requireAuth';
import * as controller from './auth.controller';

export const authRoutes = Router();

// The only public endpoint in the API.
authRoutes.post('/login', asyncHandler(controller.login));

authRoutes.post('/logout', requireAuth, asyncHandler(controller.logout));
authRoutes.get('/me', requireAuth, asyncHandler(controller.me));
authRoutes.post('/change-password', requireAuth, asyncHandler(controller.changePassword));
