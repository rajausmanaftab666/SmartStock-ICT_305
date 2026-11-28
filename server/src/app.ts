import { join, resolve } from 'node:path';
import express, { type Express } from 'express';
import { env } from './config/env';
import { sessionMiddleware } from './config/session';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRoutes } from './modules/auth/auth.routes';
import { categoryRoutes } from './modules/categories/categories.routes';
import { movementRoutes } from './modules/movements/movements.routes';
import { userRoutes } from './modules/users/users.routes';
import { productRoutes } from './modules/products/products.routes';
import { purchaseOrderRoutes } from './modules/purchaseOrders/purchaseOrders.routes';
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
  app.use('/api/purchase-orders', purchaseOrderRoutes);
  app.use('/api/stock-movements', movementRoutes);
  app.use('/api/suppliers', supplierRoutes);
  app.use('/api/settings', settingsRoutes);

  app.use('/api', notFoundHandler);

  // In production Express also serves the built React app, so the site and the
  // API share one origin and the session cookie needs no cross-site set-up.
  if (env.NODE_ENV === 'production') {
    // Render terminates TLS at its own proxy and forwards plain HTTP. Without
    // this, Express believes the connection is insecure and express-session
    // silently refuses to send the `secure` session cookie, so nobody can sign
    // in.
    app.set('trust proxy', 1);

    const dist = resolve(__dirname, '../../client/dist');
    app.use(express.static(dist));

    // Anything that is not an API call is handed to the single-page app so a
    // deep link such as /products/9 survives a refresh. Unknown /api paths are
    // excluded and still get the JSON 404 from notFoundHandler above.
    app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(join(dist, 'index.html')));
  }

  app.use(errorHandler);

  return app;
}
