import express, { type Express } from 'express';
import { sessionMiddleware } from './config/session';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRoutes } from './modules/auth/auth.routes';
import { categoryRoutes } from './modules/categories/categories.routes';
import { movementRoutes } from './modules/movements/movements.routes';
import { userRoutes } from './modules/users/users.routes';
import { productRoutes } from './modules/products/products.routes';
import { settingsRoutes } from './modules/settings/settings.routes';
import { supplierRoutes } from './modules/suppliers/suppliers.routes';

/**
 * Assembles the API. Kept separate from server.ts so tests can mount the app
 * with supertest without binding a port.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.use(sessionMiddleware());

  // Feature routes are mounted here, one pull request at a time.
  app.use('/api/auth', authRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/stock-movements', movementRoutes);
  app.use('/api/suppliers', supplierRoutes);
  app.use('/api/settings', settingsRoutes);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
